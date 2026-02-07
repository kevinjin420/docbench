import json;
import re;
import time;
import uuid;
import threading;
import traceback;
import requests;
import:jac from models.nodes, ResultNode, RunNode, TestDefNode, PublicTestConfigNode, BenchmarkModelNode, LeaderboardNode, UserNode;
import:jac from models.edges, HasResult, HasRun, HasTest, HasPublicConfig, HasBenchmarkModel, HasEntry, SubmittedBy;
import:jac from services.llm_service, run_public_benchmark, fetch_doc_content, create_openrouter_client;
import:jac from services.evaluator, evaluate_responses;
import:jac from utils.rate_limit, is_rate_allowed;
import:jac from utils.logger, log_info, log_error;
import:jac from walkers.benchmarks, running_benchmarks;

walker GetPublicTests {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = False;
    }
    can gather with `root entry {
        public_ids: set = set();
        for pc in [->:HasPublicConfig:->(`?PublicTestConfigNode)] {
            if pc.is_public {
                public_ids.add(pc.test_id);
            }
        }

        public_tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id in public_ids and tnode.is_active {
                public_tests.append({
                    "id": tnode.test_id,
                    "level": tnode.level,
                    "category": tnode.category,
                    "task": tnode.task,
                    "points": tnode.points
                });
            }
        }
        report {"tests": public_tests, "count": len(public_tests)};
    }
}

walker ValidateURL {
    has url: str = "";

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = False;
    }
    can validate with `root entry {
        if not self.url.strip() {
            report {"valid": False, "error": "URL is required"};
            disengage;
        }

        url_pattern: any = re.compile(
            r"^https?://"
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
            r"localhost|"
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
            r"(?::\d+)?"
            r"(?:/?|[/?]\S+)$", re.IGNORECASE
        );

        if not url_pattern.match(self.url.strip()) {
            report {"valid": False, "error": "Invalid URL format"};
            disengage;
        }

        try {
            response: any = requests.head(self.url.strip(), timeout=10, allow_redirects=True);
            if response.status_code < 400 {
                report {"valid": True};
            } else {
                response = requests.get(self.url.strip(), timeout=10, allow_redirects=True, stream=True);
                if response.status_code < 400 {
                    report {"valid": True};
                } else {
                    report {"valid": False, "error": f"URL returned status {response.status_code}"};
                }
            }
        } except requests.exceptions.Timeout {
            report {"valid": False, "error": "URL request timed out"};
        } except requests.exceptions.ConnectionError {
            report {"valid": False, "error": "Could not connect to URL"};
        } except Exception as e {
            report {"valid": False, "error": f"Request failed: {str(e)}"};
        }
    }
}

walker RunPublicBenchmark {
    has documentation_url: str = "";
    has documentation_content: str = "";
    has documentation_name: str = "Unnamed Documentation";
    has max_tokens: int = 16000;
    has api_key: str = "";

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = False;
    }
    can execute with `root entry {
        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }

        (allowed, retry_after) = is_rate_allowed("public_benchmark", 10, 3600);
        if not allowed {
            report {"error": "Rate limit exceeded", "retry_after": retry_after};
            disengage;
        }

        if not self.documentation_url and not self.documentation_content {
            report {"error": "documentation_url or documentation_content is required"};
            disengage;
        }

        public_ids: list = [];
        for pc in [->:HasPublicConfig:->(`?PublicTestConfigNode)] {
            if pc.is_public {
                public_ids.append(pc.test_id);
            }
        }
        if not public_ids {
            report {"error": "No public tests configured"};
            disengage;
        }

        active_models: list = [];
        for bm in [->:HasBenchmarkModel:->(`?BenchmarkModelNode)] {
            if bm.is_active {
                active_models.append({"model_id": bm.model_id, "display_name": bm.display_name});
            }
        }
        if not active_models {
            import os;
            fallback: str = os.getenv("PUBLIC_BENCHMARK_MODEL", "anthropic/claude-sonnet-4");
            active_models = [{"model_id": fallback, "display_name": fallback.split("/")[-1]}];
        }

        model_ids: list = [m["model_id"] for m in active_models];
        public_id_set: set = set(public_ids);

        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id in public_id_set and tnode.is_active {
                tests.append({
                    "id": tnode.test_id, "level": tnode.level,
                    "category": tnode.category, "task": tnode.task,
                    "points": tnode.points, "type": tnode.test_type,
                    "required_elements": tnode.required_elements,
                    "forbidden_elements": tnode.forbidden_elements,
                    "broken_code": tnode.broken_code,
                    "partial_code": tnode.partial_code,
                    "python_code": tnode.python_code,
                    "test_harness": tnode.test_harness,
                    "error_hint": tnode.error_hint,
                    "completion_hint": tnode.completion_hint
                });
            }
        }

        run_id: str = f"public_{uuid.uuid4().hex[:12]}";

        doc_content: str = "";
        if self.documentation_content {
            doc_content = self.documentation_content;
        } elif self.documentation_url {
            doc_content = fetch_doc_content(self.documentation_url) or "";
            if not doc_content {
                report {"error": "Failed to fetch documentation from URL"};
                disengage;
            }
        }

        run_node: RunNode = (here +>:HasRun:+> RunNode(
            run_id=run_id, model=",".join(model_ids), variant="public",
            status="running", started_at=time.time()
        ))[0];

        running_benchmarks[run_id] = {
            "status": "running", "progress": "Initializing...",
            "is_public": True, "models": model_ids, "model_results": {}
        };
        socket.notify_channels(["public_benchmark"], {
            "run_id": run_id, "status": "running",
            "progress": "Initializing...", "models": model_ids
        });

        api_key: str = self.api_key;
        max_tok: int = self.max_tokens;
        doc_name: str = self.documentation_name;
        doc_url: str = self.documentation_url;

        def run_in_background() -> None {
            try {
                def progress_cb(completed: int, total: int, message: str, **kwargs: any) -> None {
                    running_benchmarks[run_id].update({
                        "progress": message, "completed": completed, "total": total
                    });
                    running_benchmarks[run_id].update(kwargs);
                    socket.notify_channels(["public_benchmark"], {
                        "run_id": run_id, "status": "running",
                        "progress": message, "completed": completed, "total": total,
                        **kwargs
                    });
                }

                all_model_results: dict = run_public_benchmark(
                    api_key, doc_content, model_ids, tests,
                    max_tokens=max_tok, progress_callback=progress_cb
                );

                socket.notify_channels(["public_benchmark"], {
                    "run_id": run_id, "status": "evaluating",
                    "progress": "Evaluating responses from all models..."
                });

                all_percentages: list = [];
                all_total_scores: list = [];
                max_score_val: float | None = None;
                model_evaluations: dict = {};

                import from datetime { datetime }

                for (mid, mresult) in all_model_results.items() {
                    timestamp: str = datetime.now().strftime("%Y%m%d_%H%M%S_%f");
                    safe_model: str = mid.replace("/", "-");
                    model_run_id: str = f"public-{safe_model}-{timestamp}";

                    result_node: ResultNode = ResultNode(
                        run_id=model_run_id, model=mid, model_id=mid,
                        variant="public", temperature=0.1, max_tokens=max_tok,
                        total_tests=len(tests), responses=mresult["responses"],
                        created_at=time.time(), status="completed"
                    );
                    root +>:HasResult:+> result_node;

                    try {
                        eval_result: dict = evaluate_responses(
                            mresult["responses"], tests, test_ids=public_ids
                        );
                        result_node.evaluation_results = {
                            "category_breakdown": eval_result["evaluation_results"],
                            "level_breakdown": eval_result.get("level_breakdown", {})
                        };
                        result_node.total_score = eval_result["total_score"];
                        result_node.max_score = eval_result["max_score"];
                        result_node.percentage = eval_result["percentage"];
                        result_node.evaluation_status = "completed";
                        result_node.evaluated_at = time.time();

                        all_percentages.append(eval_result["percentage"]);
                        all_total_scores.append(eval_result["total_score"]);
                        if max_score_val is None {
                            max_score_val = eval_result["max_score"];
                        }
                        model_evaluations[mid] = {
                            "run_id": model_run_id,
                            "percentage": eval_result["percentage"],
                            "total_score": eval_result["total_score"],
                            "max_score": eval_result["max_score"]
                        };
                    } except Exception as e {
                        log_error(f"Evaluation failed for {mid}: {e}");
                        result_node.evaluation_status = "failed";
                    }
                }

                if not all_percentages {
                    raise RuntimeError("No models completed successfully");
                }

                avg_percentage: float = sum(all_percentages) / len(all_percentages);
                avg_total_score: float = sum(all_total_scores) / len(all_total_scores);

                running_benchmarks[run_id] = {
                    "status": "completed",
                    "result": {
                        "run_id": run_id,
                        "percentage": round(avg_percentage, 2),
                        "total_score": round(avg_total_score, 2),
                        "max_score": max_score_val,
                        "documentation_name": doc_name,
                        "documentation_url": doc_url,
                        "models": model_ids,
                        "model_results": model_evaluations,
                        "models_completed": len(all_percentages),
                        "models_total": len(model_ids)
                    }
                };
                run_node.status = "completed";
                run_node.completed_at = time.time();
                socket.notify_channels(["public_benchmark"], {
                    "run_id": run_id, "status": "completed",
                    "result": running_benchmarks[run_id]["result"]
                });
            } except Exception as e {
                log_error(f"Public benchmark failed: {run_id} - {e}");
                traceback.print_exc();
                running_benchmarks[run_id] = {"status": "failed", "error": str(e)};
                run_node.status = "failed";
                run_node.error_message = str(e);
                socket.notify_channels(["public_benchmark"], {
                    "run_id": run_id, "status": "failed", "error": str(e)
                });
            }
        }

        threading.Thread(target=run_in_background).start();
        report {
            "run_id": run_id, "status": "started",
            "test_count": len(tests), "models": model_ids
        };
    }
}

walker GetPublicBenchmarkStatus {
    has run_id: str;

    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = False;
    }
    can check with `root entry {
        if self.run_id in running_benchmarks {
            report running_benchmarks[self.run_id];
            disengage;
        }
        for rnode in [->:HasResult:->(`?ResultNode)] {
            if rnode.run_id == self.run_id {
                report {
                    "status": "completed" if rnode.percentage else "pending",
                    "result": {
                        "run_id": rnode.run_id,
                        "percentage": rnode.percentage,
                        "total_score": rnode.total_score,
                        "max_score": rnode.max_score
                    }
                };
                disengage;
            }
        }
        report {"error": "Benchmark not found"};
    }
}

walker SubmitToLeaderboard {
    has run_id: str;
    has documentation_name: str;
    has documentation_url: str = "";
    has submitter_email: str = "";

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = False;
    }
    can submit with `root entry {
        if not self.run_id {
            report {"error": "run_id is required"};
            disengage;
        }
        if not self.documentation_name {
            report {"error": "documentation_name is required"};
            disengage;
        }
        if not self.documentation_url {
            self.documentation_url = "file://uploaded";
        }

        percentage: float = 0.0;
        total_score: float = 0.0;
        max_score: float = 0.0;
        model_used: str = "unknown";

        benchmark_data: dict | None = running_benchmarks.get(self.run_id);
        if benchmark_data and benchmark_data.get("status") == "completed" {
            result: dict = benchmark_data.get("result", {});
            percentage = result.get("percentage", 0);
            total_score = result.get("total_score", 0);
            max_score = result.get("max_score", 0);
            models: list = result.get("models", []);
            model_used = ", ".join(models) if models else "unknown";
        } else {
            found: bool = False;
            for rnode in [->:HasResult:->(`?ResultNode)] {
                if rnode.run_id == self.run_id {
                    if rnode.percentage == 0.0 and not rnode.evaluation_results {
                        report {"error": "Benchmark has not been evaluated yet"};
                        disengage;
                    }
                    percentage = rnode.percentage;
                    total_score = rnode.total_score;
                    max_score = rnode.max_score;
                    model_used = rnode.model;
                    found = True;
                    break;
                }
            }
            if not found {
                report {"error": "Benchmark result not found"};
                disengage;
            }
        }

        entry_node: LeaderboardNode = (here +>:HasEntry:+> LeaderboardNode(
            documentation_name=self.documentation_name,
            documentation_url=self.documentation_url,
            submitter_email=self.submitter_email,
            total_score=total_score,
            max_score=max_score,
            percentage=percentage,
            model_used=model_used,
            submitted_at=time.time(),
            is_visible=True
        ))[0];

        rank: int = 1;
        for enode in [->:HasEntry:->(`?LeaderboardNode)] {
            if enode.is_visible and enode.percentage > percentage {
                rank += 1;
            }
        }

        report {"success": True, "entry_id": str(entry_node), "rank": rank, "percentage": percentage};
    }
}

walker GetLeaderboard {
    has limit: int = 50;
    has offset: int = 0;

    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = False;
    }
    can gather with `root entry {
        entries: list = [];
        for enode in [->:HasEntry:->(`?LeaderboardNode)] {
            if enode.is_visible {
                entries.append({
                    "id": str(enode),
                    "documentation_name": enode.documentation_name,
                    "documentation_url": enode.documentation_url,
                    "submitter_email": enode.submitter_email,
                    "total_score": enode.total_score,
                    "max_score": enode.max_score,
                    "percentage": enode.percentage,
                    "model_used": enode.model_used,
                    "submitted_at": enode.submitted_at,
                    "is_visible": enode.is_visible
                });
            }
        }
        entries.sort(key=lambda x: -x["percentage"]);

        limit_val: int = min(self.limit, 100);
        total: int = len(entries);
        sliced: list = entries[self.offset:self.offset + limit_val];

        report {"entries": sliced, "total": total, "limit": limit_val, "offset": self.offset};
    }
}

walker GetLeaderboardEntry {
    has entry_id: str;

    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = False;
    }
    can fetch with `root entry {
        for enode in [->:HasEntry:->(`?LeaderboardNode)] {
            if str(enode) == self.entry_id {
                report {
                    "id": str(enode),
                    "documentation_name": enode.documentation_name,
                    "documentation_url": enode.documentation_url,
                    "submitter_email": enode.submitter_email,
                    "total_score": enode.total_score,
                    "max_score": enode.max_score,
                    "percentage": enode.percentage,
                    "model_used": enode.model_used,
                    "submitted_at": enode.submitted_at,
                    "evaluation_snapshot": enode.evaluation_snapshot,
                    "is_visible": enode.is_visible
                };
                disengage;
            }
        }
        report {"error": "Entry not found"};
    }
}
