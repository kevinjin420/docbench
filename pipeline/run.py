"""Core benchmark pipeline. Load suite, call LLM, evaluate, return JSON."""

import argparse
import json
import logging
import sys
import threading
from typing import Dict, Generator, List, Optional

import requests

from .evaluator import Evaluator
from .llm import call_llm
from .validate import load_suite, validate_suite

logger = logging.getLogger(__name__)


def fetch_docs(url: str) -> str:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.text


def run_benchmark(
    api_key: str,
    model: str,
    suite_name: str = "standard",
    doc_url: Optional[str] = None,
    doc_content: Optional[str] = None,
    max_tokens: int = 16000,
    batch_size: int = 45,
    temperature: float = 0.1,
    skip_validation: bool = False,
) -> Dict:
    """Run the full benchmark pipeline and return results as a dict."""
    suite = load_suite(suite_name)

    if not skip_validation:
        validation = validate_suite(suite)
        if not validation["valid"]:
            return {"error": "Suite validation failed", "issues": validation["issues"]}

    if doc_url:
        doc_text = fetch_docs(doc_url)
    elif doc_content:
        doc_text = doc_content
    else:
        doc_text = ""

    responses = call_llm(
        api_key=api_key, model=model, suite=suite, doc_content=doc_text,
        max_tokens=max_tokens, batch_size=batch_size, temperature=temperature,
    )

    evaluator = Evaluator()
    results = evaluator.evaluate_all(responses, suite)
    results["meta"] = {
        "model": model, "suite": suite_name, "doc_url": doc_url,
        "max_tokens": max_tokens, "batch_size": batch_size, "temperature": temperature,
    }
    return results


def run_benchmark_streaming(
    api_key: str,
    model: str,
    suite_name: str = "standard",
    doc_url: Optional[str] = None,
    doc_content: Optional[str] = None,
    max_tokens: int = 16000,
    batch_size: int = 45,
    temperature: float = 0.1,
) -> Generator[Dict, None, None]:
    """Run benchmark with progress events yielded as dicts."""
    suite = load_suite(suite_name)
    num_batches = (len(suite) + batch_size - 1) // batch_size

    yield {"type": "status", "stage": "validating", "total_batches": num_batches, "total_tests": len(suite)}

    validation = validate_suite(suite)
    if not validation["valid"]:
        yield {"type": "error", "error": "Suite validation failed", "issues": validation["issues"]}
        return

    yield {"type": "status", "stage": "fetching_docs"}

    if doc_url:
        doc_text = fetch_docs(doc_url)
    elif doc_content:
        doc_text = doc_content
    else:
        doc_text = ""

    yield {"type": "status", "stage": "llm_calling", "total_batches": num_batches}

    batch_events = []
    batch_lock = threading.Lock()

    def on_batch_complete(batch_num: int, total: int, error: Optional[str]):
        with batch_lock:
            batch_events.append({
                "type": "batch",
                "batch": batch_num,
                "total_batches": total,
                "status": "error" if error else "done",
                "error": error,
            })

    responses = call_llm(
        api_key=api_key, model=model, suite=suite, doc_content=doc_text,
        max_tokens=max_tokens, batch_size=batch_size, temperature=temperature,
        on_batch_complete=on_batch_complete,
    )

    for event in batch_events:
        yield event

    yield {"type": "status", "stage": "evaluating"}

    evaluator = Evaluator()
    results = evaluator.evaluate_all(responses, suite)
    results["meta"] = {
        "model": model, "suite": suite_name, "doc_url": doc_url,
        "max_tokens": max_tokens, "batch_size": batch_size, "temperature": temperature,
    }

    yield {"type": "result", **results}


def main():
    parser = argparse.ArgumentParser(description="Run Jac DocBench pipeline")
    parser.add_argument("--api-key", required=True, help="OpenRouter API key")
    parser.add_argument("--model", required=True, help="Model ID (e.g. google/gemini-3-flash-preview)")
    parser.add_argument("--suite", default="standard", help="Test suite name")
    parser.add_argument("--doc-url", help="URL to fetch documentation from")
    parser.add_argument("--doc-content", help="Raw documentation text")
    parser.add_argument("--max-tokens", type=int, default=16000)
    parser.add_argument("--batch-size", type=int, default=45)
    parser.add_argument("--temperature", type=float, default=0.1)
    parser.add_argument("--output", "-o", help="Output file path (default: stdout)")
    parser.add_argument("--skip-validation", action="store_true")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    results = run_benchmark(
        api_key=args.api_key, model=args.model, suite_name=args.suite,
        doc_url=args.doc_url, doc_content=args.doc_content,
        max_tokens=args.max_tokens, batch_size=args.batch_size,
        temperature=args.temperature, skip_validation=args.skip_validation,
    )

    output = json.dumps(results, indent=2)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        logger.info(f"Results written to {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
