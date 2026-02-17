import from services.evaluator { EvaluatorService }
import from database { BenchmarkResultService }
import from utils.auth { require_auth_check }


walker :pub GetStats {
    has auth_token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_stats with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        try {
            evaluator = EvaluatorService();
            stats = evaluator.get_test_stats();
            report stats;
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}


walker :pub CompareStashes {
    has auth_token: str = "";
    has stash1: str = "";
    has stash2: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can compare with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.stash1 or not self.stash2 {
            report {"error": "Both stash1 and stash2 are required"};
            disengage;
        }
        try {
            results1 = BenchmarkResultService.get_collection_results(self.stash1);
            results2 = BenchmarkResultService.get_collection_results(self.stash2);

            if not results1 {
                report {"error": f"Stash not found: {self.stash1}"};
                disengage;
            }
            if not results2 {
                report {"error": f"Stash not found: {self.stash2}"};
                disengage;
            }

            (avg1, std1, scores1, count1, cat_avg1, files1) = _evaluate_collection(results1);
            (avg2, std2, scores2, count2, cat_avg2, files2) = _evaluate_collection(results2);

            all_categories = sorted(list(set(cat_avg1.keys()) | set(cat_avg2.keys())));

            report {
                "status": "success",
                "stash1": {
                    "name": self.stash1,
                    "average_score": avg1,
                    "std_dev": std1,
                    "scores": scores1,
                    "file_count": count1,
                    "category_averages": cat_avg1,
                    "filenames": files1
                },
                "stash2": {
                    "name": self.stash2,
                    "average_score": avg2,
                    "std_dev": std2,
                    "scores": scores2,
                    "file_count": count2,
                    "category_averages": cat_avg2,
                    "filenames": files2
                },
                "all_categories": all_categories
            };
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}


def _evaluate_collection(results: list) -> tuple {
    scores = [];
    category_data = {};
    filenames = [];

    for result in results {
        filenames.append(result.get("run_id", ""));
        pct = result.get("percentage");
        if pct is not None {
            scores.append(pct);
        }
        eval_results = result.get("evaluation_results", {});
        breakdown = eval_results.get("category_breakdown", {});
        for (category, cat_data) in breakdown.items() {
            if category not in category_data {
                category_data[category] = [];
            }
            category_data[category].append(cat_data.get("percentage", 0));
        }
    }

    avg_score = (sum(scores) / len(scores)) if scores else 0;
    std_dev = 0;
    if len(scores) >= 2 {
        variance = sum((s - avg_score) ** 2 for s in scores) / len(scores);
        std_dev = variance ** 0.5;
    }
    category_averages = {cat: sum(vals) / len(vals) for (cat, vals) in category_data.items()};
    return (avg_score, std_dev, scores, len(results), category_averages, filenames);
}
