import json;
import os;
import time;
import openai;
import requests;
import from utils.logger { log_info, log_debug, log_error }

glob models_cache: dict = {};

def create_openrouter_client(api_key: str) -> any {
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://github.com/jaseci-llmdocs",
            "X-Title": "Jaseci DocBench"
        }
    );
}

def fetch_available_models(api_key: str) -> list {
    client: any = create_openrouter_client(api_key);
    try {
        response: any = client.models.list();
        model_list: list = [m.model_dump() for m in response.data];
        for m in model_list {
            models_cache[m["id"]] = m;
        }
        log_info(f"Fetched {len(model_list)} models from OpenRouter");
        return model_list;
    } except Exception as e {
        log_error(f"Failed to fetch models: {e}");
        return [];
    }
}

def get_max_tokens_for_model(api_key: str, model_id: str) -> int {
    if model_id in models_cache {
        top_provider: dict = models_cache[model_id].get("top_provider", {});
        max_tok: any = top_provider.get("max_completion_tokens");
        if max_tok {
            return int(max_tok);
        }
    }
    return 8192;
}

def build_response_format(tests: list) -> dict {
    properties: dict = {};
    required_ids: list = [];
    for test in tests {
        properties[test["id"]] = {"type": "string"};
        required_ids.append(test["id"]);
    }
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "benchmark_responses",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": properties,
                "required": required_ids,
                "additionalProperties": False
            }
        }
    };
}

def construct_prompt(doc_content: str, tests_to_use: list) -> str {
    formatted_tests: list = [];
    for test in tests_to_use {
        test_data: dict = {
            "id": test["id"],
            "level": test["level"],
            "category": test["category"],
            "task": test["task"],
            "points": test["points"]
        };
        test_type: str = test.get("type", "generate");
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

    test_prompts_json: str = json.dumps({"tests": formatted_tests}, indent=2);

    prompt_template: str = "You are a Jac programming language expert. Write valid Jac code for each test case based on the documentation.\n\n# Documentation\n" + doc_content + "\n\n# Test Cases\n" + test_prompts_json + "\n\n# Instructions by Test Type\n- **generate**: Write complete Jac code from scratch based on the task description.\n- **debug**: Fix the provided broken_code. Return the corrected, working Jac code.\n- **complete**: Fill in the blanks (marked with ____) in the partial_code. Return the complete code.\n- **refactor**: Convert the provided python_code to equivalent Jac code.\n\n# Task\nReturn a JSON object mapping each test ID to Jac code. Use \\n for newlines and \\\" for quotes in the code strings.";

    return prompt_template;
}

def run_batch(client: any, model_id: str, doc_content: str, batch: list,
              temperature: float, max_tokens: int, batch_num: int,
              status_callback: any = None) -> tuple {
    max_retries: int = 3;
    for retry in range(max_retries + 1) {
        try {
            if status_callback {
                status_callback(batch_num, "running", retry, max_retries);
            }
            if retry > 0 {
                time.sleep(2 ** retry);
            }
            prompt: str = construct_prompt(doc_content, batch);
            response: any = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=build_response_format(batch)
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
    api_key: str,
    model_id: str,
    doc_content: str,
    tests_to_use: list,
    temperature: float = 0.1,
    max_tokens: int = 16000,
    batch_size: int = 45,
    custom_batch_sizes: list | None = None,
    progress_callback: any = None
) -> dict {
    import from concurrent.futures { ThreadPoolExecutor, as_completed }

    client: any = create_openrouter_client(api_key);

    batches: list = [];
    if custom_batch_sizes and len(custom_batch_sizes) > 0 {
        start_idx: int = 0;
        for (i, size) in enumerate(custom_batch_sizes) {
            end_idx: int = min(start_idx + size, len(tests_to_use));
            batches.append((i + 1, tests_to_use[start_idx:end_idx]));
            start_idx = end_idx;
            if start_idx >= len(tests_to_use) {
                break;
            }
        }
        if start_idx < len(tests_to_use) {
            batches.append((len(batches) + 1, tests_to_use[start_idx:]));
        }
    } else {
        num_batches: int = (len(tests_to_use) + batch_size - 1) // batch_size;
        for i in range(num_batches) {
            start_idx = i * batch_size;
            end_idx = min(start_idx + batch_size, len(tests_to_use));
            batches.append((i + 1, tests_to_use[start_idx:end_idx]));
        }
    }

    num_batches = len(batches);
    batch_statuses: dict = {};
    for i in range(num_batches) {
        batch_statuses[i + 1] = {"status": "pending", "retry": 0, "max_retries": 2};
    }

    responses: dict = {};
    completed: int = 0;
    failed: int = 0;
    errors: list = [];

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

    if progress_callback {
        progress_callback(0, len(tests_to_use), f"Running {num_batches} batches in parallel",
                         batch_num=0, num_batches=num_batches, batch_statuses=batch_statuses);
    }

    with ThreadPoolExecutor(max_workers=20) as executor {
        futures: list = [
            executor.submit(run_batch, client, model_id, doc_content, batch,
                          temperature, max_tokens, batch_num, batch_status_callback)
            for (batch_num, batch) in batches
        ];

        for future in as_completed(futures) {
            (bn, batch_responses, error, retries) = future.result();
            if error {
                failed += 1;
                errors.append(f"Batch {bn}: {error}");
            } else {
                responses.update(batch_responses);
            }
            completed += 1;
            if progress_callback {
                progress_callback(
                    completed * batch_size, len(tests_to_use), f"Batch {completed}/{num_batches}",
                    batch_num=completed, num_batches=num_batches, failed=failed,
                    batch_statuses=batch_statuses
                );
            }
        }
    }

    if progress_callback {
        final_status: str = "Completed";
        if failed > 0 {
            final_status = f"Completed | Failed: {failed}";
        }
        progress_callback(len(tests_to_use), len(tests_to_use), final_status,
                         failed=failed, batch_statuses=batch_statuses);
    }

    if not responses {
        raise RuntimeError(f"No responses generated - all batches failed: {'; '.join(errors)}");
    }

    return {
        "responses": responses,
        "failed_batches": failed,
        "errors": errors if errors else None
    };
}

def run_public_benchmark(
    api_key: str,
    doc_content: str,
    model_ids: list,
    tests_to_use: list,
    max_tokens: int = 16000,
    progress_callback: any = None
) -> dict {
    import from concurrent.futures { ThreadPoolExecutor, as_completed }

    client: any = create_openrouter_client(api_key);
    all_results: dict = {};

    for (idx, model_id) in enumerate(model_ids) {
        model_num: int = idx + 1;
        total_models: int = len(model_ids);

        batch_size: int = min(45, len(tests_to_use));
        num_batches: int = (len(tests_to_use) + batch_size - 1) // batch_size;
        batches: list = [];
        for i in range(num_batches) {
            start_idx: int = i * batch_size;
            end_idx: int = min(start_idx + batch_size, len(tests_to_use));
            batches.append((i + 1, tests_to_use[start_idx:end_idx]));
        }

        batch_statuses: dict = {};
        for i in range(num_batches) {
            batch_statuses[i + 1] = {"status": "pending", "retry": 0, "max_retries": 2};
        }

        responses: dict = {};
        completed: int = 0;
        failed: int = 0;

        def batch_cb(bn: int, st: str, rt: int, mr: int) -> None {
            batch_statuses[bn] = {"status": st, "retry": rt, "max_retries": mr};
            if progress_callback {
                progress_callback(
                    completed * batch_size, len(tests_to_use),
                    f"Model {model_num}/{total_models}: Batch {bn} {st}",
                    current_model=model_id, current_model_num=model_num,
                    total_models=total_models
                );
            }
        }

        with ThreadPoolExecutor(max_workers=10) as executor {
            futures: list = [
                executor.submit(run_batch, client, model_id, doc_content, batch,
                              0.1, max_tokens, batch_num, batch_cb)
                for (batch_num, batch) in batches
            ];
            for future in as_completed(futures) {
                (bn, batch_responses, error, retries) = future.result();
                if error {
                    failed += 1;
                } else {
                    responses.update(batch_responses);
                }
                completed += 1;
            }
        }

        if responses {
            all_results[model_id] = {
                "responses": responses,
                "failed_batches": failed
            };
        }
    }

    return all_results;
}

def fetch_doc_content(url: str) -> str | None {
    try {
        response: any = requests.get(url, timeout=60);
        response.raise_for_status();
        return response.text;
    } except Exception as e {
        log_error(f"Failed to fetch documentation from {url}: {e}");
        return None;
    }
}

def rerun_single_batch(
    api_key: str,
    model_id: str,
    doc_content: str,
    tests_to_use: list,
    max_tokens: int = 16000,
    batch_num: int = 1,
    batch_size: int = 45
) -> dict {
    client: any = create_openrouter_client(api_key);
    start_idx: int = (batch_num - 1) * batch_size;
    end_idx: int = min(start_idx + batch_size, len(tests_to_use));
    batch: list = tests_to_use[start_idx:end_idx];

    if not batch {
        raise ValueError(f"Batch {batch_num} is empty or out of range");
    }

    (_, responses, error, _) = run_batch(client, model_id, doc_content, batch,
                                         0.1, max_tokens, batch_num);

    if error {
        raise RuntimeError(f"Batch {batch_num} failed: {error}");
    }

    return responses;
}
