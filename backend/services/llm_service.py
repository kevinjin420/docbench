"""LLM service for running benchmarks via OpenRouter API"""

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Callable
from datetime import datetime

import openai

from database import BenchmarkResultService, DocumentationService
import logging

logger = logging.getLogger(__name__)


class LLMService:
    """Service for running LLM benchmarks via OpenRouter"""

    _models_cache: Optional[Dict[str, Dict]] = None

    def __init__(self, tests_file: str = "tests.json", api_key: Optional[str] = None):
        self.tests = self._load_tests(tests_file)
        self.api_key = api_key or os.getenv('OPENROUTER_API_KEY')
        if not self.api_key:
            raise RuntimeError("API key required: provide via header or OPENROUTER_API_KEY env var")

        self.client = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
            default_headers={
                "HTTP-Referer": "https://github.com/jaseci-llmdocs",
                "X-Title": "Jac LLM Benchmark"
            }
        )

    def _load_tests(self, tests_file: str) -> List[Dict]:
        with open(tests_file, 'r') as f:
            return json.load(f)

    def get_doc_content(self, variant: str) -> Optional[str]:
        """Fetch documentation content from URL via DocumentationService"""
        if variant == "nodocs":
            return ""
        return DocumentationService.get_variant(variant)

    def fetch_available_models(self) -> List[Dict]:
        """Fetch available models from OpenRouter API using the OpenAI client"""
        if not self.api_key:
            return []

        try:
            response = self.client.models.list()
            models = [m.model_dump() for m in response.data]
            LLMService._models_cache = {m['id']: m for m in models}
            logger.info(f"Successfully fetched {len(models)} models from OpenRouter")
            return models
        except Exception as e:
            logger.error(f"Failed to fetch models from OpenRouter: {e}")
            raise RuntimeError(f"OpenRouter API error: {e}")

    def _get_model_data(self, model_id: str) -> Optional[Dict]:
        """Get model data from cache, fetching if needed"""
        if LLMService._models_cache is None:
            self.fetch_available_models()
        return (LLMService._models_cache or {}).get(model_id)

    def get_available_variants(self) -> List[str]:
        """Get list of available documentation variants"""
        variants_data = DocumentationService.get_all_variants()
        return [v['name'] for v in variants_data]

    def _get_max_tokens_for_model(self, model_id: str) -> int:
        """Get max_tokens from model's top_provider.max_completion_tokens"""
        model_data = self._get_model_data(model_id)
        if model_data:
            top_provider = model_data.get('top_provider', {})
            max_tokens = top_provider.get('max_completion_tokens')
            if max_tokens:
                return max_tokens
        return 8192

    def _build_response_format(self, tests: List[Dict]) -> Dict:
        """Build JSON schema for structured output enforcement via OpenRouter"""
        properties = {
            test["id"]: {"type": "string"}
            for test in tests
        }
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "benchmark_responses",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": properties,
                    "required": [test["id"] for test in tests],
                    "additionalProperties": False
                }
            }
        }

    def _construct_prompt(self, doc_content: str, tests_to_use: List[Dict]) -> str:
        """Construct full prompt for LLM with support for different test types"""
        formatted_tests = []
        for test in tests_to_use:
            test_data = {
                "id": test["id"],
                "level": test["level"],
                "category": test["category"],
                "task": test["task"],
                "points": test["points"],
                "hints": test["hints"]
            }
            test_type = test.get("type", "generate")
            test_data["type"] = test_type

            if test_type == "debug" and "broken_code" in test:
                test_data["broken_code"] = test["broken_code"]
                if "error_hint" in test:
                    test_data["error_hint"] = test["error_hint"]
            elif test_type == "complete" and "partial_code" in test:
                test_data["partial_code"] = test["partial_code"]
                if "completion_hint" in test:
                    test_data["completion_hint"] = test["completion_hint"]
            elif test_type == "refactor" and "python_code" in test:
                test_data["python_code"] = test["python_code"]

            formatted_tests.append(test_data)

        test_prompts = {"tests": formatted_tests}
        test_prompts_json = json.dumps(test_prompts, indent=2)

        prompt_template = """You are a Jac programming language expert. Write valid Jac code for each test case based on the documentation.

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
        return prompt_template.format(
            doc_content=doc_content,
            test_prompts_json=test_prompts_json
        )
    def run_benchmark(
        self,
        model_id: str,
        variant: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Dict:
        """Run single-call benchmark"""
        if temperature is None:
            temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.1'))
        if max_tokens is None:
            max_tokens = self._get_max_tokens_for_model(model_id)

        doc_content = self.get_doc_content(variant)
        if doc_content is None:
            raise ValueError(f"No documentation content found for variant '{variant}'")

        tests_to_use = self.tests
        prompt = self._construct_prompt(doc_content, tests_to_use)

        max_retries = 3
        retry_delay = 20

        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    time.sleep(retry_delay)
                response = self.client.chat.completions.create(
                    model=model_id,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=self._build_response_format(tests_to_use)
                )
                response_text = response.choices[0].message.content.strip()
                break
            except Exception as e:
                if '429' in str(e) and attempt < max_retries - 1:
                    retry_delay *= 2
                else:
                    raise

        responses = json.loads(response_text)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_model_name = model_id.replace('/', '-')
        run_id = f"{safe_model_name}-{variant}-{timestamp}"

        BenchmarkResultService.create(
            run_id=run_id,
            model=model_id,
            model_id=model_id,
            variant=variant,
            temperature=temperature,
            max_tokens=max_tokens,
            total_tests=len(tests_to_use),
            responses=responses,
            batch_size=len(tests_to_use),
            num_batches=1
        )

        return {
            'run_id': run_id,
            'model': model_id,
            'variant': variant,
            'num_responses': len(responses),
            'responses': responses
        }

    def _run_batch(self, model_id: str, doc_content: str, batch: List[Dict],
                   temperature: float, max_tokens: int, batch_num: int,
                   status_callback: Optional[Callable] = None) -> tuple:
        """Run a single batch API call with retries. Returns (batch_num, responses, error, retries)"""
        max_retries = 3
        for retry in range(max_retries + 1):
            try:
                if status_callback:
                    status_callback(batch_num, "running", retry, max_retries)
                if retry > 0:
                    time.sleep(2 ** retry)
                prompt = self._construct_prompt(doc_content, batch)
                response = self.client.chat.completions.create(
                    model=model_id,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=self._build_response_format(batch)
                )
                if status_callback:
                    status_callback(batch_num, "completed", retry, max_retries)
                return (batch_num, json.loads(response.choices[0].message.content.strip()), None, retry)
            except Exception as e:
                if retry >= max_retries:
                    if status_callback:
                        status_callback(batch_num, "failed", retry, max_retries)
                    return (batch_num, {}, str(e), retry)
        return (batch_num, {}, "Unknown error", max_retries)

    def run_benchmark_concurrent(
        self,
        model_id: str,
        variant: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        batch_size: int = 45,
        custom_batch_sizes: Optional[List[int]] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict:
        """Run batched benchmark with parallel API calls"""
        if temperature is None:
            temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.1'))
        if max_tokens is None:
            max_tokens = self._get_max_tokens_for_model(model_id)

        doc_content = self.get_doc_content(variant)
        if doc_content is None:
            raise ValueError(f"No documentation content found for variant '{variant}'")

        tests_to_use = self.tests

        if custom_batch_sizes and len(custom_batch_sizes) > 0:
            total_custom = sum(custom_batch_sizes)
            if total_custom > len(tests_to_use):
                raise ValueError(f"Sum of custom batch sizes ({total_custom}) exceeds total tests ({len(tests_to_use)})")

            batches = []
            start_idx = 0
            for i, size in enumerate(custom_batch_sizes):
                end_idx = min(start_idx + size, len(tests_to_use))
                batches.append((i + 1, tests_to_use[start_idx:end_idx]))
                start_idx = end_idx
                if start_idx >= len(tests_to_use):
                    break

            if start_idx < len(tests_to_use):
                batches.append((len(batches) + 1, tests_to_use[start_idx:]))

            num_batches = len(batches)
            actual_batch_size = custom_batch_sizes[0] if custom_batch_sizes else batch_size
        else:
            num_batches = (len(tests_to_use) + batch_size - 1) // batch_size
            batches = []
            for i in range(num_batches):
                start_idx = i * batch_size
                end_idx = min(start_idx + batch_size, len(tests_to_use))
                batches.append((i + 1, tests_to_use[start_idx:end_idx]))
            actual_batch_size = batch_size

        batch_statuses = {i + 1: {"status": "pending", "retry": 0, "max_retries": 2} for i in range(num_batches)}

        def batch_status_callback(batch_num, status, retry, max_retries):
            batch_statuses[batch_num] = {"status": status, "retry": retry, "max_retries": max_retries}
            if progress_callback:
                progress_callback(
                    completed * batch_size, len(tests_to_use), f"Batch {batch_num} {status}",
                    batch_num=completed, num_batches=num_batches, failed=failed,
                    batch_statuses=batch_statuses
                )

        if progress_callback:
            progress_callback(0, len(tests_to_use), f"Running {num_batches} batches in parallel",
                            batch_num=0, num_batches=num_batches, batch_statuses=batch_statuses)

        responses = {}
        completed = 0
        failed = 0
        errors = []

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [
                executor.submit(self._run_batch, model_id, doc_content, batch, temperature, max_tokens, batch_num, batch_status_callback)
                for batch_num, batch in batches
            ]

            for future in as_completed(futures):
                batch_num, batch_responses, error, retries = future.result()
                if error:
                    failed += 1
                    errors.append(f"Batch {batch_num}: {error}")
                else:
                    responses.update(batch_responses)
                completed += 1

                if progress_callback:
                    progress_callback(
                        completed * batch_size, len(tests_to_use), f"Batch {completed}/{num_batches}",
                        batch_num=completed, num_batches=num_batches, failed=failed,
                        batch_statuses=batch_statuses
                    )

        final_status = "Completed"
        if failed > 0:
            final_status = f"Completed | Failed: {failed}"

        if progress_callback:
            progress_callback(len(tests_to_use), len(tests_to_use), final_status, failed=failed, batch_statuses=batch_statuses)

        if not responses:
            raise RuntimeError(f"No responses generated - all batches failed: {'; '.join(errors)}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_model_name = model_id.replace('/', '-')
        run_id = f"{safe_model_name}-{variant}-{timestamp}"

        BenchmarkResultService.create(
            run_id=run_id,
            model=model_id,
            model_id=model_id,
            variant=variant,
            temperature=temperature,
            max_tokens=max_tokens,
            total_tests=len(tests_to_use),
            responses=responses,
            batch_size=actual_batch_size,
            num_batches=num_batches
        )

        return {
            'run_id': run_id,
            'model': model_id,
            'variant': variant,
            'num_responses': len(responses),
            'responses': responses,
            'failed_batches': failed,
            'errors': errors if errors else None
        }

    def rerun_single_batch(
        self,
        model_id: str,
        variant: str,
        max_tokens: Optional[int] = None,
        batch_num: int = 1,
        batch_size: int = 45
    ) -> Dict:
        """Rerun a single batch and return the responses"""
        temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.1'))
        if max_tokens is None:
            max_tokens = self._get_max_tokens_for_model(model_id)

        doc_content = self.get_doc_content(variant)
        if doc_content is None:
            raise ValueError(f"No documentation content found for variant '{variant}'")

        tests_to_use = self.tests
        start_idx = (batch_num - 1) * batch_size
        end_idx = min(start_idx + batch_size, len(tests_to_use))
        batch = tests_to_use[start_idx:end_idx]

        if not batch:
            raise ValueError(f"Batch {batch_num} is empty or out of range")

        _, responses, error, _ = self._run_batch(
            model_id, doc_content, batch, temperature, max_tokens, batch_num
        )

        if error:
            raise RuntimeError(f"Batch {batch_num} failed: {error}")

        return responses

    def run_public_benchmark(
        self,
        model_id: str,
        documentation_url: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        public_test_ids: Optional[List[str]] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict:
        """Run benchmark with only public tests and user-provided documentation URL"""
        import requests

        if temperature is None:
            temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.1'))
        if max_tokens is None:
            max_tokens = self._get_max_tokens_for_model(model_id)

        try:
            response = requests.get(documentation_url, timeout=60)
            response.raise_for_status()
            doc_content = response.text
        except Exception as e:
            raise ValueError(f"Failed to fetch documentation from URL: {e}")

        if public_test_ids:
            public_test_ids_set = set(public_test_ids)
            tests_to_use = [t for t in self.tests if t['id'] in public_test_ids_set]
        else:
            tests_to_use = self.tests

        if not tests_to_use:
            raise ValueError("No tests to run")

        batch_size = min(45, len(tests_to_use))
        num_batches = (len(tests_to_use) + batch_size - 1) // batch_size
        batches = []
        for i in range(num_batches):
            start_idx = i * batch_size
            end_idx = min(start_idx + batch_size, len(tests_to_use))
            batches.append((i + 1, tests_to_use[start_idx:end_idx]))

        batch_statuses = {i + 1: {"status": "pending", "retry": 0, "max_retries": 2} for i in range(num_batches)}

        def batch_status_callback(batch_num, status, retry, max_retries):
            batch_statuses[batch_num] = {"status": status, "retry": retry, "max_retries": max_retries}
            if progress_callback:
                progress_callback(
                    completed * batch_size, len(tests_to_use), f"Batch {batch_num} {status}",
                    batch_num=completed, num_batches=num_batches
                )

        if progress_callback:
            progress_callback(0, len(tests_to_use), f"Running {num_batches} batches")

        responses = {}
        completed = 0
        failed = 0
        errors = []

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(self._run_batch, model_id, doc_content, batch, temperature, max_tokens, batch_num, batch_status_callback)
                for batch_num, batch in batches
            ]

            for future in as_completed(futures):
                batch_num, batch_responses, error, retries = future.result()
                if error:
                    failed += 1
                    errors.append(f"Batch {batch_num}: {error}")
                else:
                    responses.update(batch_responses)
                completed += 1

                if progress_callback:
                    progress_callback(
                        completed * batch_size, len(tests_to_use), f"Batch {completed}/{num_batches}"
                    )

        if progress_callback:
            progress_callback(len(tests_to_use), len(tests_to_use), "Completed")

        if not responses:
            raise RuntimeError(f"No responses generated - all batches failed: {'; '.join(errors)}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_model_name = model_id.replace('/', '-')
        run_id = f"public-{safe_model_name}-{timestamp}"

        BenchmarkResultService.create(
            run_id=run_id,
            model=model_id,
            model_id=model_id,
            variant='public',
            temperature=temperature,
            max_tokens=max_tokens,
            total_tests=len(tests_to_use),
            responses=responses,
            batch_size=batch_size,
            num_batches=num_batches,
            metadata={'documentation_url': documentation_url, 'is_public': True}
        )

        return {
            'run_id': run_id,
            'model': model_id,
            'variant': 'public',
            'num_responses': len(responses),
            'responses': responses,
            'failed_batches': failed,
            'errors': errors if errors else None
        }