import json;
import os;
import re;
import requests;
import threading;
import traceback;
import uuid;
import from services.llm_service { LLMService }
import from services.evaluator { EvaluatorService }
import from database {
    BenchmarkResultService, BenchmarkRunService,
    PublicTestConfigService, PublicBenchmarkModelService,
    LeaderboardService
}
import from utils.auth { get_authenticated_user }
import from utils.rate_limit { check_rate_limit }
import from walkers.health { running_benchmarks }


walker :pub GetPublicTests {
    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_tests with Root entry {
        test_ids = PublicTestConfigService.get_public_test_ids();
        evaluator = EvaluatorService();
        all_tests = evaluator.tests;
        public_tests = [
            {
                "id": test["id"],
                "level": test.get("level"),
                "category": test.get("category"),
                "task": test.get("task"),
                "points": test.get("points")
            }
            for test in all_tests
            if test["id"] in test_ids
        ];
        report {"tests": public_tests, "count": len(public_tests)};
    }
}


walker :pub ValidateDocUrl {
    has url: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can validate with Root entry {
        url_str = self.url.strip();
        if not url_str {
            report {"valid": False, "error": "URL is required"};
            disengage;
        }
        url_pattern = re.compile(
            r"^https?://"
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
            r"localhost|"
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
            r"(?::\d+)?"
            r"(?:/?|[/?]\S+)$", re.IGNORECASE
        );
        if not url_pattern.match(url_str) {
            report {"valid": False, "error": "Invalid URL format"};
            disengage;
        }
        try {
            response = requests.head(url_str, timeout=10, allow_redirects=True);
            if response.status_code < 400 {
                report {"valid": True};
                disengage;
            }
            response = requests.get(url_str, timeout=10, allow_redirects=True, stream=True);
            if response.status_code < 400 {
                report {"valid": True};
                disengage;
            }
            report {"valid": False, "error": f"URL returned status {response.status_code}"};
        } except requests.exceptions.Timeout {
            report {"valid": False, "error": "URL request timed out"};
        } except requests.exceptions.ConnectionError {
            report {"valid": False, "error": "Could not connect to URL"};
        } except requests.exceptions.RequestException as e {
            report {"valid": False, "error": f"Request failed: {str(e)}"};
        }
    }
}


walker :pub RunPublicBenchmark {
    has api_key: str = "";
    has documentation_url: str = "";
    has documentation_content: str = "";
    has documentation_name: str = "Unnamed Documentation";
    has max_tokens: int = 16000;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can run with Root entry {
        (allowed, err_info) = check_rate_limit("public_benchmark", max_requests=10, window_seconds=3600);
        if not allowed {
            report err_info;
            disengage;
        }

        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }
        if not self.documentation_url and not self.documentation_content {
            report {"error": "documentation_url or documentation_content is required"};
            disengage;
        }

        public_test_ids = PublicTestConfigService.get_public_test_ids();
        if not public_test_ids {
            report {"error": "No public tests configured"};
            disengage;
        }

        active_models = PublicBenchmarkModelService.get_active_models();
        if not active_models {
            fallback_model = os.getenv("PUBLIC_BENCHMARK_MODEL", "anthropic/claude-sonnet-4");
            active_models = [{"model_id": fallback_model, "display_name": fallback_model.split("/")[-1]}];
        }

        run_id = f"public_{uuid.uuid4().hex[:12]}";
        model_ids = [m["model_id"] for m in active_models];
        doc_url = self.documentation_url;
        doc_content = self.documentation_content;
        doc_name = self.documentation_name;
        max_tok = self.max_tokens;
        api_key = self.api_key;

        def run_in_background -> None {
            try {
                running_benchmarks[run_id] = {
                    "status": "running",
                    "progress": "Initializing...",
                    "is_public": True,
                    "models": model_ids,
                    "model_results": {}
                };

                llm_service = LLMService(api_key=api_key);
                BenchmarkRunService.create(run_id=run_id, model=",".join(model_ids), variant="public");

                model_run_ids = [];
                for (idx, model_id) in enumerate(model_ids) {
                    model_num = idx + 1;
                    total_models = len(model_ids);

                    def progress_callback(completed: int, total: int, message: str, **kwargs: any) -> None {
                        progress_text = f"Model {model_num}/{total_models}: {message} ({completed}/{total} tests)";
                        running_benchmarks[run_id].update({
                            "progress": progress_text,
                            "completed": completed,
                            "total": total,
                            "current_model": model_id,
                            "current_model_num": model_num
                        });
                    }

                    try {
                        result = llm_service.run_public_benchmark(
                            model_id=model_id,
                            documentation_url=doc_url,
                            documentation_content=doc_content,
                            max_tokens=max_tok,
                            public_test_ids=public_test_ids,
                            progress_callback=progress_callback
                        );
                        model_run_id = result.get("run_id", f"{run_id}_{model_id.replace('/', '-')}");
                        model_run_ids.append({"model_id": model_id, "run_id": model_run_id});
                    } except Exception as e {
                        print(f"Model {model_id} failed: {e}");
                        model_run_ids.append({"model_id": model_id, "run_id": None, "error": str(e)});
                    }
                }

                evaluator = EvaluatorService();
                all_percentages = [];
                all_total_scores = [];
                max_score = None;
                model_evaluations = {};

                for model_run in model_run_ids {
                    if model_run.get("run_id") is None {
                        continue;
                    }
                    result_data = BenchmarkResultService.get_by_run_id(model_run["run_id"]);
                    if not result_data {
                        continue;
                    }
                    try {
                        BenchmarkResultService.set_evaluation_status(model_run["run_id"], "evaluating");
                        eval_result = evaluator.evaluate_responses(
                            result_data["responses"],
                            test_ids=public_test_ids
                        );
                        BenchmarkResultService.update_evaluation(
                            run_id=model_run["run_id"],
                            evaluation_results={
                                "category_breakdown": eval_result["evaluation_results"],
                                "level_breakdown": eval_result.get("level_breakdown", {})
                            },
                            total_score=eval_result["total_score"],
                            max_score=eval_result["max_score"],
                            percentage=eval_result["percentage"]
                        );
                        all_percentages.append(eval_result["percentage"]);
                        all_total_scores.append(eval_result["total_score"]);
                        if max_score is None {
                            max_score = eval_result["max_score"];
                        }
                        model_evaluations[model_run["model_id"]] = {
                            "run_id": model_run["run_id"],
                            "percentage": eval_result["percentage"],
                            "total_score": eval_result["total_score"],
                            "max_score": eval_result["max_score"]
                        };
                    } except Exception as e {
                        print(f"Evaluation failed for {model_run['model_id']}: {e}");
                        BenchmarkResultService.set_evaluation_status(model_run["run_id"], "failed");
                    }
                }

                if not all_percentages {
                    raise RuntimeError("No models completed successfully");
                }

                avg_percentage = sum(all_percentages) / len(all_percentages);
                avg_total_score = sum(all_total_scores) / len(all_total_scores);

                running_benchmarks[run_id] = {
                    "status": "completed",
                    "result": {
                        "run_id": run_id,
                        "percentage": round(avg_percentage, 2),
                        "total_score": round(avg_total_score, 2),
                        "max_score": max_score,
                        "documentation_name": doc_name,
                        "documentation_url": doc_url,
                        "models": model_ids,
                        "model_results": model_evaluations,
                        "models_completed": len(all_percentages),
                        "models_total": len(model_ids)
                    }
                };
                BenchmarkRunService.complete(run_id=run_id, result_id=None);

            } except Exception as e {
                print(f"Public benchmark failed: {run_id} - {e}");
                traceback.print_exc();
                running_benchmarks[run_id] = {"status": "failed", "error": str(e)};
                BenchmarkRunService.fail(run_id=run_id, error_message=str(e));
            }
        }

        threading.Thread(target=run_in_background).start();
        report {
            "run_id": run_id,
            "status": "started",
            "test_count": len(public_test_ids),
            "models": model_ids
        };
    }
}


walker :pub GetPublicBenchmarkStatus {
    has run_id: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_status with Root entry {
        if not self.run_id {
            report {"error": "run_id is required"};
            disengage;
        }
        if self.run_id in running_benchmarks {
            report running_benchmarks[self.run_id];
            disengage;
        }
        result = BenchmarkResultService.get_by_run_id(self.run_id);
        if result {
            report {
                "status": ("completed") if result.get("percentage") else ("pending"),
                "result": {
                    "run_id": result["run_id"],
                    "percentage": result.get("percentage"),
                    "total_score": result.get("total_score"),
                    "max_score": result.get("max_score")
                }
            };
            disengage;
        }
        report {"error": "Benchmark not found"};
    }
}


walker :pub SubmitToLeaderboard {
    has auth_token: str = "";
    has run_id: str = "";
    has documentation_name: str = "";
    has documentation_url: str = "";
    has submitter_email: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can submit with Root entry {
        if not self.run_id {
            report {"error": "run_id is required"};
            disengage;
        }
        if not self.documentation_name {
            report {"error": "documentation_name is required"};
            disengage;
        }
        doc_url = (self.documentation_url) if self.documentation_url else ("file://uploaded");

        benchmark_data = running_benchmarks.get(self.run_id);
        if benchmark_data and benchmark_data.get("status") == "completed" {
            result = benchmark_data.get("result", {});
            percentage = result.get("percentage");
            total_score = result.get("total_score");
            max_score = result.get("max_score");
            models = result.get("models", []);
            model_used = (", ".join(models)) if models else ("unknown");
            benchmark_result_id = None;
        } else {
            db_result = BenchmarkResultService.get_by_run_id(self.run_id);
            if not db_result {
                report {"error": "Benchmark result not found"};
                disengage;
            }
            if db_result.get("percentage") is None {
                report {"error": "Benchmark has not been evaluated yet"};
                disengage;
            }
            percentage = db_result["percentage"];
            total_score = db_result["total_score"];
            max_score = db_result["max_score"];
            model_used = db_result["model"];
            benchmark_result_id = db_result["id"];
        }

        user_id = None;
        user = get_authenticated_user(self.auth_token);
        if user {
            user_id = user.get("id");
        }

        entry_id = LeaderboardService.submit(
            documentation_name=self.documentation_name,
            documentation_url=doc_url,
            total_score=total_score,
            max_score=max_score,
            percentage=percentage,
            benchmark_result_id=benchmark_result_id,
            model_used=model_used,
            submitter_email=self.submitter_email,
            user_id=user_id
        );
        rank = LeaderboardService.get_rank_for_percentage(percentage);
        report {
            "success": True,
            "entry_id": entry_id,
            "rank": rank,
            "percentage": percentage
        };
    }
}


walker :pub GetLeaderboard {
    has limit: int = 50;
    has offset: int = 0;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_lb with Root entry {
        actual_limit = min(self.limit, 100);
        entries = LeaderboardService.get_leaderboard(limit=actual_limit, offset=self.offset);
        total = LeaderboardService.get_total_count();
        report {
            "entries": entries,
            "total": total,
            "limit": actual_limit,
            "offset": self.offset
        };
    }
}


walker :pub GetLeaderboardEntry {
    has entry_id: int = 0;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_entry with Root entry {
        if not self.entry_id {
            report {"error": "entry_id is required"};
            disengage;
        }
        entry_data = LeaderboardService.get_entry_by_id(self.entry_id);
        if not entry_data {
            report {"error": "Entry not found"};
            disengage;
        }
        report entry_data;
    }
}
