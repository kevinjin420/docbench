import from models.nodes { ResultNode, CollectionNode }
import from models.edges { HasResult, HasCollection, InCollection }
import from services.graph_service { collections_bar_chart, evaluation_runs_chart, comparison_chart }

walker : pub GraphCollections {
    has format: str = "svg";

    can generate with `root entry {
        collections_data: list = [];
        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            scores: list = [];
            model: str = "";
            variant: str = "";
            for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
                if rnode.percentage > 0 {
                    scores.append(rnode.percentage);
                    model = rnode.model;
                    variant = rnode.variant;
                }
            }
            if scores {
                avg: float = sum(scores) / len(scores);
                std: float = (sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0.0;
                collections_data.append({
                    "name": cnode.name,
                    "model": model,
                    "variant": variant,
                    "average_score": round(avg, 2),
                    "std_dev": round(std, 2)
                });
            }
        }

        chart_bytes: bytes = collections_bar_chart(collections_data, self.format);
        import base64;
        report {
            "chart": base64.b64encode(chart_bytes).decode("utf-8"),
            "format": self.format,
            "content_type": f"image/{self.format}"
        };
    }
}

walker : pub GraphEvaluation {
    has collection_name: str;
    has format: str = "svg";

    can generate with `root entry {
        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if cnode.name == self.collection_name {
                runs_data: list = [];
                for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
                    runs_data.append({
                        "name": rnode.run_id,
                        "percentage": rnode.percentage
                    });
                }
                chart_bytes: bytes = evaluation_runs_chart(runs_data, f"Evaluation: {self.collection_name}", self.format);
                import base64;
                report {
                    "chart": base64.b64encode(chart_bytes).decode("utf-8"),
                    "format": self.format,
                    "content_type": f"image/{self.format}"
                };
                disengage;
            }
        }
        report {"error": "Collection not found"};
    }
}

walker : pub GraphCompare {
    has stash1: str;
    has stash2: str;
    has format: str = "svg";

    can generate with `root entry {
        stash1_data: dict = {};
        stash2_data: dict = {};
        categories: list = [];

        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if cnode.name == self.stash1 or cnode.name == self.stash2 {
                scores: list = [];
                cat_scores: dict = {};
                for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
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
                    cat_avgs[cat] = sum(cat_s) / len(cat_s) if cat_s else 0;
                    if cat not in categories {
                        categories.append(cat);
                    }
                }

                data: dict = {
                    "name": cnode.name,
                    "average_score": round(avg, 2),
                    "std_dev": round(std, 2),
                    "category_averages": cat_avgs
                };

                if cnode.name == self.stash1 {
                    stash1_data = data;
                } else {
                    stash2_data = data;
                }
            }
        }

        chart_bytes: bytes = comparison_chart(stash1_data, stash2_data, categories, self.format);
        import base64;
        report {
            "chart": base64.b64encode(chart_bytes).decode("utf-8"),
            "format": self.format,
            "content_type": f"image/{self.format}"
        };
    }
}
