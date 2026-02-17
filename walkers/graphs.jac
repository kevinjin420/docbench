import from services.graph_service { GraphService }
import from database { BenchmarkResultService }
import from utils.auth { require_auth_check }


walker :pub GraphCollections {
    has auth_token: str = "";
    has format: str = "svg";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can generate with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        fmt = self.format.lower();
        if fmt not in ("svg", "png") {
            fmt = "svg";
        }
        try {
            collections = BenchmarkResultService.get_collections();
            collections_data = [];
            for coll in collections {
                coll_name = coll.get("name", "");
                results = BenchmarkResultService.get_collection_results(coll_name);
                if not results {
                    continue;
                }
                scores = [r.get("percentage", 0) for r in results if r.get("percentage") is not None];
                avg = (sum(scores) / len(scores)) if scores else 0;
                std_dev = ((sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5) if len(scores) > 1 else 0;
                first = (results[0]) if results else ({});
                model_name = first.get("model", "Unknown");
                variant = first.get("variant", "");
                collections_data.append({
                    "name": coll_name,
                    "model": model_name,
                    "variant": variant,
                    "average_score": avg,
                    "std_dev": std_dev,
                    "count": len(results)
                });
            }
            graph_bytes = GraphService.collections_bar_chart(collections_data, fmt);
            import base64;
            mimetype = ("image/svg+xml") if fmt == "svg" else ("image/png");
            report {
                "data": base64.b64encode(graph_bytes).decode("utf-8"),
                "mimetype": mimetype,
                "format": fmt
            };
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}


walker :pub GraphEvaluation {
    has auth_token: str = "";
    has collection: str = "";
    has format: str = "svg";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can generate with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.collection {
            report {"error": "collection is required"};
            disengage;
        }
        fmt = self.format.lower();
        if fmt not in ("svg", "png") {
            fmt = "svg";
        }
        try {
            results = BenchmarkResultService.get_collection_results(self.collection);
            if not results {
                report {"error": "Collection not found"};
                disengage;
            }
            runs_data = [
                {"name": r.get("run_id", ""), "percentage": r.get("percentage", 0)}
                for r in results
            ];
            first = (results[0]) if results else ({});
            model_name = first.get("model", "Unknown");
            variant = first.get("variant", "");
            title = (f"{model_name} - {variant}") if variant else (model_name);
            graph_bytes = GraphService.evaluation_runs_chart(runs_data, title=title, fmt=fmt);
            import base64;
            mimetype = ("image/svg+xml") if fmt == "svg" else ("image/png");
            report {
                "data": base64.b64encode(graph_bytes).decode("utf-8"),
                "mimetype": mimetype,
                "format": fmt
            };
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}


walker :pub GraphCompare {
    has auth_token: str = "";
    has stash1: str = "";
    has stash2: str = "";
    has format: str = "svg";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can generate with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.stash1 or not self.stash2 {
            report {"error": "Both stash1 and stash2 are required"};
            disengage;
        }
        fmt = self.format.lower();
        if fmt not in ("svg", "png") {
            fmt = "svg";
        }
        try {
            results1 = BenchmarkResultService.get_collection_results(self.stash1);
            results2 = BenchmarkResultService.get_collection_results(self.stash2);
            if not results1 or not results2 {
                report {"error": "One or both stashes not found"};
                disengage;
            }
            stash1_data = _process_results(results1, self.stash1);
            stash2_data = _process_results(results2, self.stash2);
            all_categories = sorted(
                list(set(stash1_data["category_averages"].keys()) | set(stash2_data["category_averages"].keys()))
            );
            graph_bytes = GraphService.comparison_chart(stash1_data, stash2_data, all_categories, fmt);
            import base64;
            mimetype = ("image/svg+xml") if fmt == "svg" else ("image/png");
            report {
                "data": base64.b64encode(graph_bytes).decode("utf-8"),
                "mimetype": mimetype,
                "format": fmt
            };
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}


def _process_results(results: list, name: str) -> dict {
    scores = [r.get("percentage", 0) for r in results if r.get("percentage") is not None];
    avg = (sum(scores) / len(scores)) if scores else 0;
    std_dev = ((sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5) if len(scores) > 1 else 0;
    category_data = {};
    for result in results {
        eval_results = result.get("evaluation_results", {});
        breakdown = eval_results.get("category_breakdown", {});
        for (cat, cat_data) in breakdown.items() {
            if cat not in category_data {
                category_data[cat] = [];
            }
            category_data[cat].append(cat_data.get("percentage", 0));
        }
    }
    category_averages = {cat: sum(vals) / len(vals) for (cat, vals) in category_data.items()};
    return {
        "name": name,
        "average_score": avg,
        "std_dev": std_dev,
        "category_averages": category_averages
    };
}
