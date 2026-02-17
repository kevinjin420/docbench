import threading;
import traceback;
import uuid;
import from services.llm_service { LLMService }
import from services.evaluator { EvaluatorService }
import from database { BenchmarkRunService, BenchmarkResultService }
import from utils.auth { require_auth_check }
import from walkers.health { running_benchmarks }


walker :pub RunBenchmark {
    has auth_token: str = "";
    has api_key: str = "";
    has model: str = "";
    has variant: str = "";
    has max_tokens: int = 16000;
    has batch_size: int = 45;
    has custom_batch_sizes: list = [];

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can run with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }
        if not self.model or not self.variant {
            report {"error": "model and variant are required"};
            disengage;
        }

        run_id = f"{self.model}_{self.variant}_{uuid.uuid4().hex[:8]}";
        model_val = self.model;
        variant_val = self.variant;
        max_tokens = self.max_tokens;
        batch_size = self.batch_size;
        custom_batch_sizes = self.custom_batch_sizes;
        api_key = self.api_key;

        def run_in_background -> None {
            try {
                running_benchmarks[run_id] = {"status": "running", "progress": "Initializing..."};

                llm_service = LLMService(api_key=api_key);
                BenchmarkRunService.create(run_id=run_id, model=model_val, variant=variant_val);

                def progress_callback(completed: int, total: int, message: str,
                                      batch_num: int | None = None, num_batches: int | None = None,
                                      failed: int = 0, batch_statuses: list | None = None) -> None {
                    progress_text = f"{message} ({completed}/{total} tests)";
                    running_benchmarks[run_id].update({
                        "progress": progress_text,
                        "completed": completed,
                        "total": total,
                        "failed": failed,
                        "batch_num": batch_num,
                        "num_batches": num_batches,
                        "batch_statuses": batch_statuses
                    });
                }

                result = llm_service.run_benchmark_concurrent(
                    model_val, variant_val, max_tokens=max_tokens,
                    batch_size=batch_size, custom_batch_sizes=custom_batch_sizes,
                    progress_callback=progress_callback
                );

                actual_run_id = result.get("run_id", run_id);
                result_data = BenchmarkResultService.get_by_run_id(actual_run_id);

                if result_data {
                    try {
                        BenchmarkResultService.set_evaluation_status(actual_run_id, "evaluating");
                        evaluator = EvaluatorService();
                        eval_result = evaluator.evaluate_responses(result_data["responses"]);
                        BenchmarkResultService.update_evaluation(
                            run_id=actual_run_id,
                            evaluation_results={
                                "category_breakdown": eval_result["evaluation_results"],
                                "level_breakdown": eval_result.get("level_breakdown", {})
                            },
                            total_score=eval_result["total_score"],
                            max_score=eval_result["max_score"],
                            percentage=eval_result["percentage"]
                        );
                    } except Exception as e {
                        print(f"Evaluation failed for {actual_run_id}: {e}");
                        BenchmarkResultService.set_evaluation_status(actual_run_id, "failed");
                    }
                }

                running_benchmarks[run_id] = {"status": "completed", "result": result, "progress": "Done"};
                BenchmarkRunService.complete(run_id=actual_run_id, result_id=None);

            } except Exception as e {
                print(f"Benchmark failed: {run_id} - {e}");
                traceback.print_exc();
                running_benchmarks[run_id] = {"status": "failed", "error": str(e), "progress": "Failed"};
                BenchmarkRunService.fail(run_id=run_id, error_message=str(e));
            }
        }

        threading.Thread(target=run_in_background).start();
        report {"run_id": run_id, "status": "started"};
    }
}


walker :pub Evaluate {
    has auth_token: str = "";
    has file: str = "";
    has run_id: str = "";
    has force: bool = False;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can evaluate with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.file and not self.run_id {
            report {"error": "file or run_id is required"};
            disengage;
        }
        actual_run_id = self.run_id;
        if self.file and not actual_run_id {
            actual_run_id = self.file.split("/")[-1].replace(".txt", "");
        }

        result = BenchmarkResultService.get_by_run_id(actual_run_id);
        if not result {
            report {"error": "Result not found"};
            disengage;
        }

        eval_status = result.get("evaluation_status");
        if eval_status == "evaluating" {
            report {"status": "evaluating", "message": "Evaluation in progress. Please wait...", "run_id": actual_run_id};
            disengage;
        }
        if eval_status == "failed" {
            report {"status": "failed", "message": "Evaluation failed", "run_id": actual_run_id};
            disengage;
        }

        eval_results = result.get("evaluation_results");
        needs_eval = self.force or not eval_results or "category_breakdown" not in eval_results;

        if needs_eval {
            evaluator = EvaluatorService();
            eval_result = evaluator.evaluate_responses(result["responses"]);
            BenchmarkResultService.update_evaluation(
                run_id=actual_run_id,
                evaluation_results={
                    "category_breakdown": eval_result["evaluation_results"],
                    "level_breakdown": eval_result.get("level_breakdown", {})
                },
                total_score=eval_result["total_score"],
                max_score=eval_result["max_score"],
                percentage=eval_result["percentage"]
            );
            report {
                "summary": {
                    "total_score": eval_result["total_score"],
                    "total_max": eval_result["max_score"],
                    "overall_percentage": eval_result["percentage"],
                    "category_breakdown": eval_result["evaluation_results"],
                    "level_breakdown": eval_result.get("level_breakdown", {}),
                    "tests_completed": eval_result.get("tests_completed", 0)
                },
                "run_id": result.get("run_id"),
                "model": result.get("model"),
                "model_id": result.get("model_id"),
                "variant": result.get("variant"),
                "temperature": result.get("temperature"),
                "max_tokens": result.get("max_tokens"),
                "total_tests": result.get("total_tests", 0),
                "batch_size": result.get("batch_size"),
                "num_batches": result.get("num_batches"),
                "created_at": result.get("created_at"),
                "evaluated_at": result.get("evaluated_at"),
                "status": result.get("status")
            };
            disengage;
        }

        category_breakdown = eval_results.get("category_breakdown", {});
        tests_completed = sum(len(c.get("tests", [])) for c in category_breakdown.values());
        report {
            "summary": {
                "total_score": result["total_score"],
                "total_max": result["max_score"],
                "overall_percentage": result["percentage"],
                "category_breakdown": category_breakdown,
                "level_breakdown": eval_results.get("level_breakdown", {}),
                "tests_completed": tests_completed
            },
            "run_id": result.get("run_id"),
            "model": result.get("model"),
            "model_id": result.get("model_id"),
            "variant": result.get("variant"),
            "temperature": result.get("temperature"),
            "max_tokens": result.get("max_tokens"),
            "total_tests": result.get("total_tests", 0),
            "batch_size": result.get("batch_size"),
            "num_batches": result.get("num_batches"),
            "created_at": result.get("created_at"),
            "evaluated_at": result.get("evaluated_at"),
            "status": result.get("status")
        };
    }
}


walker :pub RerunBatch {
    has auth_token: str = "";
    has api_key: str = "";
    has run_id: str = "";
    has batch_num: int = -1;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can rerun with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }
        if not self.run_id or self.batch_num < 0 {
            report {"error": "run_id and batch_num are required"};
            disengage;
        }

        result = BenchmarkResultService.get_by_run_id(self.run_id);
        if not result {
            report {"error": "Result not found"};
            disengage;
        }

        model_val = result.get("model");
        variant_val = result.get("variant");
        max_tokens = result.get("max_tokens", 16000);
        batch_size = result.get("batch_size", 45);
        orig_run_id = self.run_id;
        batch_num = self.batch_num;
        api_key = self.api_key;
        rerun_id = f"rerun_{orig_run_id}_{batch_num}";

        def run_in_background -> None {
            try {
                running_benchmarks[rerun_id] = {
                    "status": "running",
                    "progress": f"Rerunning batch {batch_num}...",
                    "original_run_id": orig_run_id,
                    "batch_num": batch_num
                };
                llm_service = LLMService(api_key=api_key);
                batch_responses = llm_service.rerun_single_batch(
                    model_val, variant_val, max_tokens=max_tokens,
                    batch_num=batch_num, batch_size=batch_size
                );
                current_responses = result.get("responses", {});
                current_responses.update(batch_responses);
                BenchmarkResultService.update_responses(orig_run_id, current_responses);
                running_benchmarks[rerun_id] = {
                    "status": "completed",
                    "progress": f"Batch {batch_num} completed",
                    "responses": batch_responses
                };
            } except Exception as e {
                print(f"Batch rerun failed: {rerun_id} - {e}");
                traceback.print_exc();
                running_benchmarks[rerun_id] = {"status": "failed", "error": str(e)};
            }
        }

        threading.Thread(target=run_in_background).start();
        report {"rerun_id": rerun_id, "status": "started", "batch_num": self.batch_num};
    }
}


walker :pub EvaluateCollection {
    has auth_token: str = "";
    has collection: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can evaluate_coll with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.collection {
            report {"error": "collection is required"};
            disengage;
        }

        results = BenchmarkResultService.get_collection_results(self.collection);
        if not results {
            report {"error": "Collection not found or empty"};
            disengage;
        }

        evaluated = {};
        for result in results {
            rid = result["run_id"];
            eval_results = result.get("evaluation_results");
            needs_eval = not eval_results or "category_breakdown" not in eval_results;

            if needs_eval {
                evaluator = EvaluatorService();
                eval_result = evaluator.evaluate_responses(result["responses"]);
                BenchmarkResultService.update_evaluation(
                    run_id=rid,
                    evaluation_results={
                        "category_breakdown": eval_result["evaluation_results"],
                        "level_breakdown": eval_result.get("level_breakdown", {})
                    },
                    total_score=eval_result["total_score"],
                    max_score=eval_result["max_score"],
                    percentage=eval_result["percentage"]
                );
                evaluated[rid] = {
                    "summary": {
                        "overall_percentage": eval_result["percentage"],
                        "total_score": eval_result["total_score"],
                        "total_max": eval_result["max_score"],
                        "tests_completed": eval_result.get("tests_completed", 0),
                        "category_breakdown": eval_result["evaluation_results"]
                    }
                };
            } else {
                category_breakdown = eval_results.get("category_breakdown", {});
                tests_completed = sum(len(c.get("tests", [])) for c in category_breakdown.values());
                evaluated[rid] = {
                    "summary": {
                        "overall_percentage": result.get("percentage", 0),
                        "total_score": result.get("total_score", 0),
                        "total_max": result.get("max_score", 0),
                        "tests_completed": tests_completed,
                        "category_breakdown": category_breakdown
                    }
                };
            }
        }

        report {
            "status": "success",
            "collection": self.collection,
            "files_evaluated": len(evaluated),
            "results": evaluated
        };
    }
}
