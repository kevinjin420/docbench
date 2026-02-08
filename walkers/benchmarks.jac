import json;
import time;
import uuid;
import threading;
import traceback;
import from models.nodes { ResultNode, RunNode, VariantNode, TestDefNode }
import from models.edges { HasResult, HasRun, HasVariant, HasTest }
import from services.llm_service { run_benchmark_concurrent, rerun_single_batch, fetch_doc_content }
import from services.evaluator { evaluate_responses }
import from utils.logger { log_info, log_debug, log_error }

glob running_benchmarks: dict = {};

walker RunBenchmark {
    has model: str;
    has variant: str;
    has max_tokens: int = 16000;
    has batch_size: int = 45;
    has custom_batch_sizes: list = [];
    has api_key: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
        static has auth: bool = True;
    }
    can execute with `root entry {
        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }
        if not self.model or not self.variant {
            report {"error": "model and variant are required"};
            disengage;
        }

        run_id: str = f"{self.model}_{self.variant}_{uuid.uuid4().hex[:8]}";

        doc_content: str | None = None;
        for vnode in [->:HasVariant:->(`?VariantNode)] {
            if vnode.variant_name == self.variant {
                doc_content = fetch_doc_content(vnode.url);
                break;
            }
        }
        if self.variant == "nodocs" {
            doc_content = "";
        }
        if doc_content is None {
            report {"error": f"No documentation found for variant '{self.variant}'"};
            disengage;
        }

        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.is_active {
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

        if not tests {
            report {"error": "No test definitions found"};
            disengage;
        }

        run_node: RunNode = (here +>:HasRun:+> RunNode(
            run_id=run_id, model=self.model, variant=self.variant,
            status="running", started_at=time.time()
        ))[0];

        running_benchmarks[run_id] = {"status": "running", "progress": "Initializing..."};
        socket.notify_channels(["benchmark"], {
            "run_id": run_id, "status": "running", "progress": "Initializing..."
        });

        api_key: str = self.api_key;
        model_id: str = self.model;
        batch_sz: int = self.batch_size;
        custom_bs: list = self.custom_batch_sizes;
        max_tok: int = self.max_tokens;

        def run_in_background() -> None {
            try {
                def progress_callback(completed: int, total: int, message: str, **kwargs: any) -> None {
                    running_benchmarks[run_id].update({
                        "progress": f"{message} ({completed}/{total} tests)",
                        "completed": completed,
                        "total": total
                    });
                    running_benchmarks[run_id].update(kwargs);
                    socket.notify_channels(["benchmark"], {
                        "run_id": run_id, "status": "running",
                        "progress": f"{message} ({completed}/{total} tests)",
                        "completed": completed, "total": total,
                        **kwargs
                    });
                }

                result: dict = run_benchmark_concurrent(
                    api_key, model_id, doc_content, tests,
                    max_tokens=max_tok, batch_size=batch_sz,
                    custom_batch_sizes=custom_bs if custom_bs else None,
                    progress_callback=progress_callback
                );

                import from datetime { datetime }
                timestamp: str = datetime.now().strftime("%Y%m%d_%H%M%S_%f");
                safe_model: str = model_id.replace("/", "-");
                actual_run_id: str = f"{safe_model}-{self.variant}-{timestamp}";

                result_node: ResultNode = ResultNode(
                    run_id=actual_run_id, model=model_id, model_id=model_id,
                    variant=self.variant, temperature=0.1, max_tokens=max_tok,
                    total_tests=len(tests), batch_size=batch_sz,
                    num_batches=len(result.get("responses", {})),
                    responses=result["responses"],
                    created_at=time.time(), status="completed"
                );
                root +>:HasResult:+> result_node;

                socket.notify_channels(["benchmark"], {
                    "run_id": run_id, "status": "evaluating",
                    "progress": "Evaluating responses..."
                });

                eval_result: dict = evaluate_responses(
                    result["responses"], tests
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

                run_node.status = "completed";
                run_node.completed_at = time.time();

                running_benchmarks[run_id] = {
                    "status": "completed",
                    "result": {
                        "run_id": actual_run_id,
                        "model": model_id,
                        "variant": self.variant,
                        "num_responses": len(result["responses"]),
                        "percentage": eval_result["percentage"]
                    }
                };
                socket.notify_channels(["benchmark"], {
                    "run_id": run_id, "status": "completed",
                    "result": running_benchmarks[run_id]["result"]
                });

            } except Exception as e {
                log_error(f"Benchmark failed: {run_id} - {e}");
                traceback.print_exc();
                running_benchmarks[run_id] = {"status": "failed", "error": str(e)};
                run_node.status = "failed";
                run_node.error_message = str(e);
                socket.notify_channels(["benchmark"], {
                    "run_id": run_id, "status": "failed", "error": str(e)
                });
            }
        }

        threading.Thread(target=run_in_background).start();
        report {"run_id": run_id, "status": "started"};
    }
}

walker EvaluateResult {
    has run_id: str;
    has force: bool = False;

    obj __specs__ {
        static has methods: list = ["post"];
        static has auth: bool = True;
    }
    can evaluate with `root entry {
        target: ResultNode | None = None;
        for rnode in [->:HasResult:->(`?ResultNode)] {
            if rnode.run_id == self.run_id {
                target = rnode;
                break;
            }
        }
        if target is None {
            report {"error": "Result not found"};
            disengage;
        }

        if target.evaluation_status == "evaluating" {
            report {"status": "evaluating", "message": "Evaluation in progress"};
            disengage;
        }

        needs_eval: bool = self.force or not target.evaluation_results or "category_breakdown" not in target.evaluation_results;

        if needs_eval {
            tests: list = [];
            for tnode in [->:HasTest:->(`?TestDefNode)] {
                if tnode.is_active {
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

            target.evaluation_status = "evaluating";
            eval_result: dict = evaluate_responses(target.responses, tests);

            target.evaluation_results = {
                "category_breakdown": eval_result["evaluation_results"],
                "level_breakdown": eval_result.get("level_breakdown", {})
            };
            target.total_score = eval_result["total_score"];
            target.max_score = eval_result["max_score"];
            target.percentage = eval_result["percentage"];
            target.evaluation_status = "completed";
            target.evaluated_at = time.time();
        }

        category_breakdown: dict = target.evaluation_results.get("category_breakdown", {});
        tests_completed: int = sum(len(c.get("tests", [])) for c in category_breakdown.values());

        report {
            "summary": {
                "total_score": target.total_score,
                "total_max": target.max_score,
                "overall_percentage": target.percentage,
                "category_breakdown": category_breakdown,
                "level_breakdown": target.evaluation_results.get("level_breakdown", {}),
                "tests_completed": tests_completed
            },
            "run_id": target.run_id,
            "model": target.model,
            "model_id": target.model_id,
            "variant": target.variant,
            "temperature": target.temperature,
            "max_tokens": target.max_tokens,
            "total_tests": target.total_tests,
            "batch_size": target.batch_size,
            "num_batches": target.num_batches,
            "created_at": target.created_at,
            "evaluated_at": target.evaluated_at,
            "status": target.status
        };
    }
}

walker RerunBatch {
    has run_id: str;
    has batch_num: int;
    has api_key: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
        static has auth: bool = True;
    }
    can execute with `root entry {
        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }

        target: ResultNode | None = None;
        for rnode in [->:HasResult:->(`?ResultNode)] {
            if rnode.run_id == self.run_id {
                target = rnode;
                break;
            }
        }
        if target is None {
            report {"error": "Result not found"};
            disengage;
        }

        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.is_active {
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

        doc_content: str = "";
        for vnode in [->:HasVariant:->(`?VariantNode)] {
            if vnode.variant_name == target.variant {
                doc_content = fetch_doc_content(vnode.url) or "";
                break;
            }
        }

        batch_responses: dict = rerun_single_batch(
            self.api_key, target.model, doc_content, tests,
            max_tokens=target.max_tokens,
            batch_num=self.batch_num,
            batch_size=target.batch_size
        );

        current_responses: dict = target.responses;
        current_responses.update(batch_responses);
        target.responses = current_responses;

        rerun_id: str = f"rerun_{self.run_id}_{self.batch_num}";
        socket.notify_channels(["benchmark"], {
            "rerun_id": rerun_id, "run_id": self.run_id,
            "batch_num": self.batch_num, "status": "completed",
            "num_responses": len(batch_responses)
        });

        report {"rerun_id": rerun_id, "status": "completed", "batch_num": self.batch_num};
    }
}

walker EvaluateCollection {
    has collection_name: str;

    obj __specs__ {
        static has methods: list = ["post"];
        static has auth: bool = True;
    }
    can evaluate with `root entry {
        import from models.nodes { CollectionNode }
        import from models.edges { HasCollection, InCollection }

        target_coll: CollectionNode | None = None;
        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if cnode.name == self.collection_name {
                target_coll = cnode;
                break;
            }
        }
        if target_coll is None {
            report {"error": "Collection not found"};
            disengage;
        }

        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.is_active {
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

        evaluated: dict = {};
        for rnode in [target_coll ->:InCollection:->(`?ResultNode)] {
            needs_eval: bool = not rnode.evaluation_results or "category_breakdown" not in rnode.evaluation_results;
            if needs_eval {
                eval_result: dict = evaluate_responses(rnode.responses, tests);
                rnode.evaluation_results = {
                    "category_breakdown": eval_result["evaluation_results"],
                    "level_breakdown": eval_result.get("level_breakdown", {})
                };
                rnode.total_score = eval_result["total_score"];
                rnode.max_score = eval_result["max_score"];
                rnode.percentage = eval_result["percentage"];
                rnode.evaluation_status = "completed";
                rnode.evaluated_at = time.time();
            }
            evaluated[rnode.run_id] = {
                "summary": {
                    "overall_percentage": rnode.percentage,
                    "total_score": rnode.total_score,
                    "total_max": rnode.max_score
                }
            };
        }

        report {
            "status": "success",
            "collection": self.collection_name,
            "files_evaluated": len(evaluated),
            "results": evaluated
        };
    }
}
