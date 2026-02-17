import json;
import os;
import time;
import logging;
import openai;
import from concurrent.futures { ThreadPoolExecutor, as_completed }
import from datetime { datetime }
import from database { BenchmarkResultService, DocumentationService, TestDefinitionService }

glob logger: any = logging.getLogger(__name__);


obj LLMService {
    has api_key: str = "";
    has tests: list = [];
    has client: any = None;

    static has _models_cache: dict | None = None;

    def postinit {
        self.tests = self._load_from_db();
        if not self.api_key {
            self.api_key = os.getenv("OPENROUTER_API_KEY", "");
        }
        if not self.api_key {
            raise RuntimeError("API key required: provide via header or OPENROUTER_API_KEY env var");
        }
        self.client = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
            default_headers={
                "HTTP-Referer": "https://github.com/jaseci-llmdocs",
                "X-Title": "Jaseci DocBench"
            }
        );
    }

    def _load_from_db -> list {
        try {
            tests = TestDefinitionService.get_all(include_inactive=False);
            if tests {
                return tests;
            }
        } except Exception as e {
            logger.warning(f"Could not load tests from database: {e}");
        }
        return [];
    }

    def get_doc_content(variant: str) -> str | None {
        if variant == "nodocs" {
            return "";
        }
        return DocumentationService.get_variant(variant);
    }

    def fetch_available_models -> list {
        if not self.api_key {
            return [];
        }
        try {
            response = self.client.models.list();
            models = [m.model_dump() for m in response.data];
            LLMService._models_cache = {m["id"]: m for m in models};
            return models;
        } except Exception as e {
            raise RuntimeError(f"OpenRouter API error: {e}");
        }
    }

    def _get_model_data(model_id: str) -> dict | None {
        if LLMService._models_cache is None {
            self.fetch_available_models();
        }
        return (LLMService._models_cache or {}).get(model_id);
    }

    def get_available_variants -> list {
        variants_data = DocumentationService.get_all_variants();
        return [v["name"] for v in variants_data];
    }

    def _get_max_tokens_for_model(model_id: str) -> int {
        model_data = self._get_model_data(model_id);
        if model_data {
            top_provider = model_data.get("top_provider", {});
            max_tokens = top_provider.get("max_completion_tokens");
            if max_tokens {
                return max_tokens;
            }
        }
        return 8192;
    }

    def _build_response_format(tests: list) -> dict {
        properties = {
            test["id"]: {"type": "string"}
            for test in tests
        };
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
        };
    }

    def _construct_prompt(doc_content: str, tests_to_use: list) -> str {
        formatted_tests = [];
        for test in tests_to_use {
            test_data = {
                "id": test["id"], "level": test["level"],
                "category": test["category"], "task": test["task"],
                "points": test["points"]
            };
            test_type = test.get("type", "generate");
            test_data["type"] = test_type;
            if test_type == "debug" and "broken_code" in test {
                test_data["broken_code"] = test["broken_code"];
                if "error_hint" in test {
                    test_data["error_hint"] = test["error_hint"];
                }
            } elif test_type == "complete" and "partial_code" in test {
                test_data["partial_code"] = test["partial_code"];
                if "completion_hint" in test {
                    test_data["completion_hint"] = test["completion_hint"];
                }
            } elif test_type == "refactor" and "python_code" in test {
                test_data["python_code"] = test["python_code"];
            }
            formatted_tests.append(test_data);
        }
        test_prompts = {"tests": formatted_tests};
        test_prompts_json = json.dumps(test_prompts, indent=2);

        prompt_template = "You are a Jac programming language expert. Write valid Jac code for each test case based on the documentation.\n\n# Documentation\n{doc_content}\n\n# Test Cases\n{test_prompts_json}\n\n# Instructions by Test Type\n- **generate**: Write complete Jac code from scratch based on the task description.\n- **debug**: Fix the provided broken_code. Return the corrected, working Jac code.\n- **complete**: Fill in the blanks (marked with ____) in the partial_code. Return the complete code.\n- **refactor**: Convert the provided python_code to equivalent Jac code.\n\n# Task\nReturn a JSON object mapping each test ID to Jac code. Use \\n for newlines and \\\" for quotes in the code strings.";
        return prompt_template.format(
            doc_content=doc_content,
            test_prompts_json=test_prompts_json
        );
    }

    def _run_batch(
        model_id: str, doc_content: str, batch: list,
        temperature: float, max_tokens: int, batch_num: int,
        status_callback: any = None
    ) -> tuple {
        max_retries = 3;
        for retry in range(max_retries + 1) {
            try {
                if status_callback {
                    status_callback(batch_num, "running", retry, max_retries);
                }
                if retry > 0 {
                    time.sleep(2 ** retry);
                }
                prompt = self._construct_prompt(doc_content, batch);
                response = self.client.chat.completions.create(
                    model=model_id,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=self._build_response_format(batch)
                );
                if status_callback {
                    status_callback(batch_num, "completed", retry, max_retries);
                }
                return (batch_num, json.loads(response.choices[0].message.content.strip()), None, retry);
            } except Exception as e {
                if retry >= max_retries {
                    if status_callback {
                        status_callback(batch_num, "failed", retry, max_retries);
                    }
                    return (batch_num, {}, str(e), retry);
                }
            }
        }
        return (batch_num, {}, "Unknown error", max_retries);
    }

    def run_benchmark_concurrent(
        model_id: str, variant: str,
        temperature: float | None = None, max_tokens: int | None = None,
        batch_size: int = 45, custom_batch_sizes: list | None = None,
        progress_callback: any = None
    ) -> dict {
        if temperature is None {
            temperature = float(os.getenv("DEFAULT_TEMPERATURE", "0.1"));
        }
        if max_tokens is None {
            max_tokens = self._get_max_tokens_for_model(model_id);
        }
        doc_content = self.get_doc_content(variant);
        if doc_content is None {
            raise ValueError(f"No documentation content found for variant '{variant}'");
        }
        tests_to_use = self.tests;

        if custom_batch_sizes and len(custom_batch_sizes) > 0 {
            batches = [];
            start_idx = 0;
            for (i, size) in enumerate(custom_batch_sizes) {
                end_idx = min(start_idx + size, len(tests_to_use));
                batches.append((i + 1, tests_to_use[start_idx:end_idx]));
                start_idx = end_idx;
                if start_idx >= len(tests_to_use) {
                    break;
                }
            }
            if start_idx < len(tests_to_use) {
                batches.append((len(batches) + 1, tests_to_use[start_idx:]));
            }
            num_batches = len(batches);
            actual_batch_size = custom_batch_sizes[0] if custom_batch_sizes else batch_size;
        } else {
            num_batches = (len(tests_to_use) + batch_size - 1) // batch_size;
            batches = [];
            for i in range(num_batches) {
                start_idx = i * batch_size;
                end_idx = min(start_idx + batch_size, len(tests_to_use));
                batches.append((i + 1, tests_to_use[start_idx:end_idx]));
            }
            actual_batch_size = batch_size;
        }

        batch_statuses = {i + 1: {"status": "pending", "retry": 0, "max_retries": 2} for i in range(num_batches)};

        if progress_callback {
            progress_callback(0, len(tests_to_use), f"Running {num_batches} batches in parallel",
                            batch_num=0, num_batches=num_batches, batch_statuses=batch_statuses);
        }

        responses = {};
        completed = 0;
        failed = 0;
        errors = [];

        def batch_status_callback(bn: int, st: str, rt: int, mr: int) -> None {
            batch_statuses[bn] = {"status": st, "retry": rt, "max_retries": mr};
            if progress_callback {
                progress_callback(
                    completed * batch_size, len(tests_to_use), f"Batch {bn} {st}",
                    batch_num=completed, num_batches=num_batches, failed=failed,
                    batch_statuses=batch_statuses
                );
            }
        }

        with ThreadPoolExecutor(max_workers=20) as executor {
            futures = [
                executor.submit(self._run_batch, model_id, doc_content, batch,
                               temperature, max_tokens, batch_num, batch_status_callback)
                for (batch_num, batch) in batches
            ];
            for future in as_completed(futures) {
                (batch_num, batch_responses, error, retries) = future.result();
                if error {
                    failed += 1;
                    errors.append(f"Batch {batch_num}: {error}");
                } else {
                    responses.update(batch_responses);
                }
                completed += 1;
                if progress_callback {
                    progress_callback(
                        completed * batch_size, len(tests_to_use),
                        f"Batch {completed}/{num_batches}",
                        batch_num=completed, num_batches=num_batches,
                        failed=failed, batch_statuses=batch_statuses
                    );
                }
            }
        }

        if progress_callback {
            final_status = ("Completed") if failed == 0 else f"Completed | Failed: {failed}";
            progress_callback(len(tests_to_use), len(tests_to_use), final_status,
                            failed=failed, batch_statuses=batch_statuses);
        }

        if not responses {
            raise RuntimeError(f"No responses generated - all batches failed: {'; '.join(errors)}");
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f");
        safe_model_name = model_id.replace("/", "-");
        run_id = f"{safe_model_name}-{variant}-{timestamp}";

        BenchmarkResultService.create(
            run_id=run_id, model=model_id, model_id=model_id,
            variant=variant, temperature=temperature,
            max_tokens=max_tokens, total_tests=len(tests_to_use),
            responses=responses, batch_size=actual_batch_size,
            num_batches=num_batches
        );

        return {
            "run_id": run_id, "model": model_id, "variant": variant,
            "num_responses": len(responses), "responses": responses,
            "failed_batches": failed,
            "errors": (errors) if errors else None
        };
    }

    def rerun_single_batch(
        model_id: str, variant: str,
        max_tokens: int | None = None,
        batch_num: int = 1, batch_size: int = 45
    ) -> dict {
        temperature = float(os.getenv("DEFAULT_TEMPERATURE", "0.1"));
        if max_tokens is None {
            max_tokens = self._get_max_tokens_for_model(model_id);
        }
        doc_content = self.get_doc_content(variant);
        if doc_content is None {
            raise ValueError(f"No documentation content found for variant '{variant}'");
        }
        tests_to_use = self.tests;
        start_idx = (batch_num - 1) * batch_size;
        end_idx = min(start_idx + batch_size, len(tests_to_use));
        batch = tests_to_use[start_idx:end_idx];
        if not batch {
            raise ValueError(f"Batch {batch_num} is empty or out of range");
        }
        (_, batch_responses, error, _) = self._run_batch(
            model_id, doc_content, batch, temperature, max_tokens, batch_num
        );
        if error {
            raise RuntimeError(f"Batch {batch_num} failed: {error}");
        }
        return batch_responses;
    }

    def run_public_benchmark(
        model_id: str = "",
        documentation_url: str | None = None,
        documentation_content: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        public_test_ids: list | None = None,
        progress_callback: any = None
    ) -> dict {
        import requests;
        if temperature is None {
            temperature = float(os.getenv("DEFAULT_TEMPERATURE", "0.1"));
        }
        if max_tokens is None {
            max_tokens = self._get_max_tokens_for_model(model_id);
        }
        if documentation_content {
            doc_content = documentation_content;
        } elif documentation_url {
            try {
                response = requests.get(documentation_url, timeout=60);
                response.raise_for_status();
                doc_content = response.text;
            } except Exception as e {
                raise ValueError(f"Failed to fetch documentation from URL: {e}");
            }
        } else {
            raise ValueError("Either documentation_url or documentation_content is required");
        }

        if public_test_ids {
            public_test_ids_set = set(public_test_ids);
            tests_to_use = [t for t in self.tests if t["id"] in public_test_ids_set];
        } else {
            tests_to_use = self.tests;
        }

        if not tests_to_use {
            raise ValueError("No tests to run");
        }

        batch_size_val = min(45, len(tests_to_use));
        num_batches = (len(tests_to_use) + batch_size_val - 1) // batch_size_val;
        batches = [];
        for i in range(num_batches) {
            start_idx = i * batch_size_val;
            end_idx = min(start_idx + batch_size_val, len(tests_to_use));
            batches.append((i + 1, tests_to_use[start_idx:end_idx]));
        }

        batch_statuses = {i + 1: {"status": "pending", "retry": 0, "max_retries": 2} for i in range(num_batches)};

        if progress_callback {
            progress_callback(0, len(tests_to_use), f"Running {num_batches} batches");
        }

        responses = {};
        completed = 0;
        failed = 0;
        errors = [];

        def batch_status_callback(bn: int, st: str, rt: int, mr: int) -> None {
            batch_statuses[bn] = {"status": st, "retry": rt, "max_retries": mr};
            if progress_callback {
                progress_callback(
                    completed * batch_size_val, len(tests_to_use),
                    f"Batch {bn} {st}",
                    batch_num=completed, num_batches=num_batches
                );
            }
        }

        with ThreadPoolExecutor(max_workers=10) as executor {
            futures = [
                executor.submit(self._run_batch, model_id, doc_content, batch,
                               temperature, max_tokens, batch_num, batch_status_callback)
                for (batch_num, batch) in batches
            ];
            for future in as_completed(futures) {
                (batch_num, batch_responses, error, retries) = future.result();
                if error {
                    failed += 1;
                    errors.append(f"Batch {batch_num}: {error}");
                } else {
                    responses.update(batch_responses);
                }
                completed += 1;
                if progress_callback {
                    progress_callback(
                        completed * batch_size_val, len(tests_to_use),
                        f"Batch {completed}/{num_batches}"
                    );
                }
            }
        }

        if progress_callback {
            progress_callback(len(tests_to_use), len(tests_to_use), "Completed");
        }

        if not responses {
            raise RuntimeError(f"No responses generated - all batches failed: {'; '.join(errors)}");
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f");
        safe_model_name = model_id.replace("/", "-");
        run_id = f"public-{safe_model_name}-{timestamp}";

        BenchmarkResultService.create(
            run_id=run_id, model=model_id, model_id=model_id,
            variant="public", temperature=temperature,
            max_tokens=max_tokens, total_tests=len(tests_to_use),
            responses=responses, batch_size=batch_size_val,
            num_batches=num_batches,
            metadata={"documentation_url": documentation_url, "is_public": True}
        );

        return {
            "run_id": run_id, "model": model_id, "variant": "public",
            "num_responses": len(responses), "responses": responses,
            "failed_batches": failed,
            "errors": (errors) if errors else None
        };
    }
}
