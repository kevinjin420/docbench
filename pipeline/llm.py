"""OpenRouter LLM integration for running benchmark batches."""

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

import openai

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are a Jac programming language expert. Write valid Jac code for each test case based on the documentation.

# Documentation
{doc_content}

# Test Cases
{test_prompts_json}

# Instructions by Test Type
- **generate**: Write complete Jac code from scratch based on the task description.
- **debug**: Fix the provided broken_code. Return the corrected, working Jac code.
- **complete**: Fill in the blanks (marked with ____) in the partial_code. Return the complete code.
- **refactor**: Convert the provided python_code to equivalent Jac code.

# Task
Return a JSON object mapping each test ID to Jac code. Use \\n for newlines and \\" for quotes in the code strings.
"""


def _build_response_schema(tests: List[Dict]) -> Dict:
    properties = {t["id"]: {"type": "string"} for t in tests}
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "benchmark_responses",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": properties,
                "required": [t["id"] for t in tests],
                "additionalProperties": False,
            },
        },
    }


def _format_tests_for_prompt(tests: List[Dict]) -> str:
    formatted = []
    for test in tests:
        entry = {
            "id": test["id"],
            "level": test["level"],
            "category": test["category"],
            "task": test["task"],
            "points": test["points"],
            "type": test.get("type", "generate"),
        }
        test_type = entry["type"]
        if test_type == "debug" and "broken_code" in test:
            entry["broken_code"] = test["broken_code"]
            if "error_hint" in test:
                entry["error_hint"] = test["error_hint"]
        elif test_type == "complete" and "partial_code" in test:
            entry["partial_code"] = test["partial_code"]
            if "completion_hint" in test:
                entry["completion_hint"] = test["completion_hint"]
        elif test_type == "refactor" and "python_code" in test:
            entry["python_code"] = test["python_code"]
        formatted.append(entry)
    return json.dumps({"tests": formatted}, indent=2)


def _run_single_batch(
    client: openai.OpenAI,
    model: str,
    doc_content: str,
    batch: List[Dict],
    temperature: float,
    max_tokens: int,
    batch_num: int,
) -> tuple:
    """Run one batch with retries. Returns (batch_num, responses_dict, error)."""
    prompt = PROMPT_TEMPLATE.format(
        doc_content=doc_content,
        test_prompts_json=_format_tests_for_prompt(batch),
    )
    schema = _build_response_schema(batch)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                time.sleep(2 ** attempt)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=schema,
            )
            parsed = json.loads(response.choices[0].message.content.strip())
            logger.info(f"Batch {batch_num} completed ({len(parsed)} responses)")
            return batch_num, parsed, None
        except Exception as e:
            if attempt >= max_retries - 1:
                logger.error(f"Batch {batch_num} failed after {max_retries} attempts: {e}")
                return batch_num, {}, str(e)
    return batch_num, {}, "Unknown error"


def call_llm(
    api_key: str,
    model: str,
    suite: List[Dict],
    doc_content: str,
    max_tokens: int = 16000,
    batch_size: int = 45,
    temperature: float = 0.1,
) -> Dict[str, str]:
    """Send all tests to the LLM in batches and return {test_id: code} responses."""
    client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://github.com/jaseci-llmdocs",
            "X-Title": "Jaseci DocBench",
        },
    )

    num_batches = (len(suite) + batch_size - 1) // batch_size
    batches = []
    for i in range(num_batches):
        start = i * batch_size
        batches.append((i + 1, suite[start : start + batch_size]))

    logger.info(f"Running {num_batches} batches ({len(suite)} tests, batch_size={batch_size})")

    responses: Dict[str, str] = {}
    errors = []

    with ThreadPoolExecutor(max_workers=min(20, num_batches)) as executor:
        futures = [
            executor.submit(
                _run_single_batch, client, model, doc_content,
                batch, temperature, max_tokens, batch_num,
            )
            for batch_num, batch in batches
        ]
        for future in as_completed(futures):
            batch_num, batch_responses, error = future.result()
            if error:
                errors.append(f"Batch {batch_num}: {error}")
            else:
                responses.update(batch_responses)

    if not responses:
        raise RuntimeError(f"All batches failed: {'; '.join(errors)}")

    if errors:
        logger.warning(f"{len(errors)} batch(es) failed: {'; '.join(errors)}")

    return responses
