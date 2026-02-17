import json;
import os;
import subprocess;
import tempfile;
import from concurrent.futures { ThreadPoolExecutor, as_completed }
import from pathlib { Path }
import from utils.syntax { SyntaxChecker, patch_missing_braces }
import from database { TestDefinitionService }

glob MAX_WORKERS: int = os.cpu_count() or 4;


obj EvaluatorService {
    has tests: list = [];

    def postinit {
        self.tests = self._load_from_db();
    }

    def _load_from_db -> list {
        try {
            tests = TestDefinitionService.get_all(include_inactive=False);
            if tests {
                return tests;
            }
        } except Exception as e {
            print(f"Warning: Could not load tests from database: {e}");
        }
        return [];
    }

    def _get_jac_cmd -> str {
        jac_cmd = os.path.abspath("venv/bin/jac");
        if os.path.exists(jac_cmd) {
            return jac_cmd;
        }
        return "jac";
    }

    def jac_check(code: str) -> tuple {
        errors = [];
        warnings = [];
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jac", delete=False) as f {
            f.write(code);
            temp_path = f.name;
        }
        try {
            jac_cmd = self._get_jac_cmd();
            result = subprocess.run(
                [jac_cmd, "check", temp_path],
                capture_output=True, text=True, timeout=10
            );
            output = result.stdout + result.stderr;
            for line in output.split("\n") {
                line = line.strip();
                if line.startswith("Error:") or ("error" in line.lower() and ":" in line) {
                    errors.append(line);
                } elif line.startswith("Warning:") {
                    warnings.append(line);
                }
            }
            is_valid = result.returncode == 0;
        } except subprocess.TimeoutExpired {
            errors.append("Syntax check timed out");
            is_valid = False;
        } except FileNotFoundError {
            warnings.append("jac command not found - skipping syntax validation");
            is_valid = True;
        } except Exception as e {
            errors.append(f"Syntax check failed: {str(e)}");
            is_valid = False;
        } finally {
            try {
                os.unlink(temp_path);
            } except Exception {
                0;
            }
        }
        return (is_valid, errors, warnings);
    }

    def jac_run(code: str) -> tuple {
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jac", delete=False) as f {
            f.write(code);
            temp_path = f.name;
        }
        try {
            jac_cmd = self._get_jac_cmd();
            result = subprocess.run(
                [jac_cmd, "run", temp_path],
                capture_output=True, text=True, timeout=30
            );
            output = result.stdout + result.stderr;
            success = result.returncode == 0;
            return (success, output);
        } except subprocess.TimeoutExpired {
            return (False, "Runtime execution timed out");
        } except FileNotFoundError {
            return (True, "jac command not found - skipping runtime validation");
        } except Exception as e {
            return (False, f"Runtime execution failed: {str(e)}");
        } finally {
            try {
                os.unlink(temp_path);
            } except Exception {
                0;
            }
        }
    }

    def run_functional_test(code: str, harness: str) -> tuple {
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jac", delete=False) as f {
            f.write(code + "\n\n" + harness);
            temp_path = f.name;
        }
        try {
            jac_cmd = self._get_jac_cmd();
            result = subprocess.run(
                [jac_cmd, "test", temp_path],
                capture_output=True, text=True, timeout=30
            );
            return (result.returncode == 0, result.stdout + result.stderr);
        } except subprocess.TimeoutExpired {
            return (False, "Functional test timed out");
        } except Exception as e {
            return (False, f"Functional test failed to run: {str(e)}");
        } finally {
            try {
                os.unlink(temp_path);
            } except Exception {
                0;
            }
        }
    }

    def evaluate_code(code: str, test_case: dict, use_jac_check: bool = True) -> dict {
        score = 0;
        max_score_val = test_case["points"];
        passed_checks = [];
        failed_checks = [];
        penalties = {
            "required": 0.0, "forbidden": 0.0,
            "syntax": 0.0, "jac_check": 0.0, "functional": 0.0
        };
        syntax_errors = 0;

        required_found = 0;
        for element in test_case["required_elements"] {
            found = SyntaxChecker.validate_element_strict(code, element);
            if found {
                required_found += 1;
                passed_checks.append(f"[PASS] Found required element: '{element}'");
            } else {
                failed_checks.append(f"[FAIL] Missing required element: '{element}'");
            }
        }

        forbidden_found = 0;
        for element in test_case.get("forbidden_elements", []) {
            if element in code {
                forbidden_found += 1;
                failed_checks.append(f"[FAIL] Contains forbidden element: '{element}'");
            } else {
                passed_checks.append(f"[PASS] Correctly avoided: '{element}'");
            }
        }

        total_required = len(test_case["required_elements"]);
        total_forbidden = len(test_case.get("forbidden_elements", []));

        if total_required > 0 {
            required_score = (required_found / total_required) * max_score_val;
            penalties["required"] = max_score_val - required_score;
        } else {
            required_score = max_score_val;
        }

        if total_forbidden > 0 {
            forbidden_penalty = (forbidden_found / total_forbidden) * (max_score_val * 0.4);
            penalties["forbidden"] = forbidden_penalty;
        } else {
            forbidden_penalty = 0;
        }

        score = max(0, required_score - forbidden_penalty);

        syntax_checks = SyntaxChecker.check_syntax(code);

        jac_valid = True;
        jac_errors = [];
        jac_warnings = [];
        if use_jac_check {
            (jac_valid, jac_errors, jac_warnings) = self.jac_check(code);
            if not jac_valid {
                jac_penalty = max_score_val * 0.50;
                penalties["jac_check"] = jac_penalty;
                score = max(0, score - jac_penalty);
                failed_checks.append(f"[FAIL] jac check failed: {len(jac_errors)} errors");
            } else {
                passed_checks.append("[PASS] jac check passed");
            }
        } else {
            syntax_errors = len([c for c in syntax_checks if c.startswith("[WARN]")]);
            syntax_penalty = min(syntax_errors * 0.10 * max_score_val, max_score_val * 0.50);
            penalties["syntax"] = syntax_penalty;
            score = max(0, score - syntax_penalty);
        }

        if test_case.get("type") == "functional" {
            harness = test_case.get("test_harness", "");
            if jac_valid {
                (func_passed, func_output) = self.run_functional_test(code, harness);
                if func_passed {
                    passed_checks.append("[PASS] Functional tests passed");
                } else {
                    func_penalty = score;
                    penalties["functional"] = func_penalty;
                    score = 0;
                    failed_checks.append(f"[FAIL] Functional tests failed:\n{func_output[:500]}...");
                }
            } else {
                func_penalty = score;
                penalties["functional"] = func_penalty;
                score = 0;
                failed_checks.append("[FAIL] Functional tests skipped due to compilation error");
            }
        }

        return {
            "test_id": test_case["id"],
            "category": test_case["category"],
            "level": test_case["level"],
            "score": round(score, 2),
            "max_score": max_score_val,
            "score_breakdown": penalties,
            "percentage": round((score / max_score_val) * 100, 2),
            "required_found": f"{required_found}/{total_required}",
            "forbidden_found": forbidden_found,
            "passed_checks": passed_checks,
            "failed_checks": failed_checks,
            "syntax_feedback": syntax_checks,
            "syntax_errors": syntax_errors,
            "jac_valid": jac_valid,
            "jac_errors": jac_errors,
            "jac_warnings": jac_warnings,
            "code": code
        };
    }

    def _evaluate_single(test_case: dict, code: str) -> dict {
        (patched_code, _) = patch_missing_braces(code);
        return self.evaluate_code(patched_code, test_case);
    }

    def evaluate_responses(responses: dict, test_ids: list | None = None) -> dict {
        results = [];
        category_scores = {};
        level_scores = {};
        test_ids_set = set(test_ids) if test_ids else None;

        tasks = [];
        missing_tests = [];
        for test_case in self.tests {
            tid = test_case["id"];
            if test_ids_set and tid not in test_ids_set {
                continue;
            }
            if tid in responses {
                tasks.append((test_case, responses[tid]));
            } else {
                missing_tests.append(test_case);
            }
        }

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor {
            futures = {
                executor.submit(self._evaluate_single, tc, code): tc
                for (tc, code) in tasks
            };
            for future in as_completed(futures) {
                result = future.result();
                results.append(result);
                category = result["category"];
                if category not in category_scores {
                    category_scores[category] = {
                        "score": 0, "max": 0, "count": 0,
                        "penalties": {"required": 0, "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0}
                    };
                }
                category_scores[category]["score"] += result["score"];
                category_scores[category]["max"] += result["max_score"];
                category_scores[category]["count"] += 1;
                breakdown = result.get("score_breakdown", {});
                for (k, v) in breakdown.items() {
                    category_scores[category]["penalties"][k] += v;
                }
                level = result["level"];
                if level not in level_scores {
                    level_scores[level] = {"score": 0, "max": 0, "count": 0};
                }
                level_scores[level]["score"] += result["score"];
                level_scores[level]["max"] += result["max_score"];
                level_scores[level]["count"] += 1;
            }
        }

        for test_case in missing_tests {
            missing_result = {
                "test_id": test_case["id"], "category": test_case["category"],
                "level": test_case["level"], "score": 0,
                "max_score": test_case["points"],
                "score_breakdown": {"required": test_case["points"], "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0},
                "percentage": 0, "required_found": "0/0",
                "forbidden_found": 0, "passed_checks": [],
                "failed_checks": ["[FAIL] No response generated for this test"],
                "syntax_feedback": [], "syntax_errors": 0,
                "jac_valid": False, "jac_errors": ["No code to check"],
                "jac_warnings": [], "code": ""
            };
            results.append(missing_result);
            category = test_case["category"];
            if category not in category_scores {
                category_scores[category] = {
                    "score": 0, "max": 0, "count": 0,
                    "penalties": {"required": 0, "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0}
                };
            }
            category_scores[category]["max"] += test_case["points"];
            category_scores[category]["count"] += 1;
            category_scores[category]["penalties"]["required"] += test_case["points"];
            level = test_case["level"];
            if level not in level_scores {
                level_scores[level] = {"score": 0, "max": 0, "count": 0};
            }
            level_scores[level]["max"] += test_case["points"];
            level_scores[level]["count"] += 1;
        }

        total_score = sum(r["score"] for r in results);
        total_max = sum(r["max_score"] for r in results);
        overall_percentage = (total_score / total_max * 100) if total_max > 0 else 0;

        return {
            "evaluation_results": {
                cat: {
                    "score": round(scores["score"], 2),
                    "max": scores["max"],
                    "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                    "count": scores["count"],
                    "penalties": {k: round(v, 2) for (k, v) in scores["penalties"].items()},
                    "tests": [r for r in results if r["category"] == cat]
                }
                for (cat, scores) in category_scores.items()
            },
            "level_breakdown": {
                f"Level {level}": {
                    "score": round(scores["score"], 2),
                    "max": scores["max"],
                    "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                    "count": scores["count"]
                }
                for (level, scores) in sorted(level_scores.items())
            },
            "total_score": round(total_score, 2),
            "max_score": total_max,
            "percentage": round(overall_percentage, 2),
            "tests_completed": len(results),
            "tests_missing": len(missing_tests)
        };
    }

    def get_test_stats -> dict {
        level_stats = {};
        category_stats = {};
        for test in self.tests {
            level = test["level"];
            category = test["category"];
            if level not in level_stats {
                level_stats[level] = {"count": 0, "points": 0};
            }
            level_stats[level]["count"] += 1;
            level_stats[level]["points"] += test["points"];
            if category not in category_stats {
                category_stats[category] = {"count": 0, "points": 0};
            }
            category_stats[category]["count"] += 1;
            category_stats[category]["points"] += test["points"];
        }
        total_points = sum(t["points"] for t in self.tests);
        return {
            "total_tests": len(self.tests),
            "total_points": total_points,
            "levels": level_stats,
            "categories": category_stats
        };
    }
}
