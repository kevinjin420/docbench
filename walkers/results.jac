import from models.nodes { ResultNode, CollectionNode, TestDefNode }
import from models.edges { HasResult, HasCollection, InCollection, HasTest }
import from services.evaluator { get_test_stats }

walker : pub GetStats {
    can gather with `root entry {
        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.is_active {
                tests.append({
                    "id": tnode.test_id,
                    "level": tnode.level,
                    "category": tnode.category,
                    "points": tnode.points
                });
            }
        }
        stats: dict = get_test_stats(tests);
        report stats;
    }
}

walker : pub CompareStashes {
    has stash1: str;
    has stash2: str;

    can compare with `root entry {
        def compute_stash_stats(stash_name: str) -> dict {
            for cnode in [->:HasCollection:->(`?CollectionNode)] {
                if cnode.name == stash_name {
                    scores: list = [];
                    cat_scores: dict = {};
                    file_count: int = 0;

                    for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
                        file_count += 1;
                        scores.append(rnode.percentage);
                        if rnode.evaluation_results {
                            for (cat, cdata) in rnode.evaluation_results.get("category_breakdown", {}).items() {
                                if cat not in cat_scores {
                                    cat_scores[cat] = [];
                                }
                                cat_scores[cat].append(cdata.get("percentage", 0));
                            }
                        }
                    }

                    avg: float = sum(scores) / len(scores) if scores else 0.0;
                    std: float = (sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0.0;

                    cat_avgs: dict = {};
                    for (cat, cat_s) in cat_scores.items() {
                        cat_avgs[cat] = round(sum(cat_s) / len(cat_s), 2) if cat_s else 0;
                    }

                    return {
                        "name": stash_name,
                        "average_score": round(avg, 2),
                        "std_dev": round(std, 2),
                        "file_count": file_count,
                        "category_averages": cat_avgs
                    };
                }
            }
            return {};
        }

        s1: dict = compute_stash_stats(self.stash1);
        s2: dict = compute_stash_stats(self.stash2);

        if not s1 or not s2 {
            report {"error": "One or both stashes not found"};
            disengage;
        }

        all_categories: list = list(set(list(s1.get("category_averages", {}).keys()) + list(s2.get("category_averages", {}).keys())));

        report {
            "stash1": s1,
            "stash2": s2,
            "categories": all_categories
        };
    }
}
