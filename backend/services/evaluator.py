"""Code evaluation service for Jac benchmarks"""

import json
import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Any, Tuple

from ..utils.syntax import SyntaxChecker, patch_missing_braces

MAX_WORKERS = os.cpu_count() or 4


class EvaluatorService:
    """Service for evaluating Jac code against test requirements"""

    def __init__(self, tests_file: str = None, use_db: bool = True):
        """Initialize evaluator with test cases.

        Args:
            tests_file: Path to tests.json file (used if use_db=False)
            use_db: If True, load tests from database. If False, load from file.
        """
        if use_db:
            self.tests = self._load_from_db()
        elif tests_file:
            self.tests = self._load_test_cases(tests_file)
        else:
            self.tests = self._load_from_db()

    def _load_from_db(self) -> List[Dict]:
        """Load test cases from database"""
        try:
            from database import TestDefinitionService
            tests = TestDefinitionService.get_all(include_inactive=False)
            if tests:
                return tests
        except Exception as e:
            print(f"Warning: Could not load tests from database: {e}")
        return self._load_test_cases("tests.json")

    def _load_test_cases(self, tests_file: str) -> List[Dict]:
        """Load test cases from JSON file"""
        tests_path = Path(tests_file)
        with open(tests_path, 'r') as f:
            return json.load(f)

    def _get_jac_cmd(self) -> str:
        """Get the jac command, preferring venv binary"""
        jac_cmd = os.path.abspath("venv/bin/jac")
        if os.path.exists(jac_cmd):
            return jac_cmd
        return "jac"

    def jac_check(self, code: str) -> Tuple[bool, List[str], List[str]]:
        """
        Run jac check on code and return (is_valid, errors, warnings).
        Uses jaclang's syntax checker for validation.
        """
        errors = []
        warnings = []

        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.jac', delete=False
        ) as f:
            f.write(code)
            temp_path = f.name

        try:
            jac_cmd = self._get_jac_cmd()
            result = subprocess.run(
                [jac_cmd, 'check', temp_path],
                capture_output=True,
                text=True,
                timeout=10
            )

            output = result.stdout + result.stderr

            for line in output.split('\n'):
                line = line.strip()
                if line.startswith('Error:') or ('error' in line.lower() and ':' in line):
                    errors.append(line)
                elif line.startswith('Warning:'):
                    warnings.append(line)

            is_valid = result.returncode == 0

        except subprocess.TimeoutExpired:
            errors.append("Syntax check timed out")
            is_valid = False
        except FileNotFoundError:
            warnings.append("jac command not found - skipping syntax validation")
            is_valid = True
        except Exception as e:
            errors.append(f"Syntax check failed: {str(e)}")
            is_valid = False
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass

        return is_valid, errors, warnings

    def jac_run(self, code: str) -> Tuple[bool, str]:
        """
        Run jac run on code and return (success, output).
        Used for runtime validation of generated code.
        """
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.jac', delete=False
        ) as f:
            f.write(code)
            temp_path = f.name

        try:
            jac_cmd = self._get_jac_cmd()
            result = subprocess.run(
                [jac_cmd, 'run', temp_path],
                capture_output=True,
                text=True,
                timeout=30
            )

            output = result.stdout + result.stderr
            success = result.returncode == 0

            return success, output

        except subprocess.TimeoutExpired:
            return False, "Runtime execution timed out"
        except FileNotFoundError:
            return True, "jac command not found - skipping runtime validation"
        except Exception as e:
            return False, f"Runtime execution failed: {str(e)}"
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass

    def run_functional_test(self, code: str, harness: str) -> Tuple[bool, str]:
        """
        Run functional tests using jac test.
        Combines generated code with harness code in a temporary file.
        """
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.jac', delete=False
        ) as f:
            f.write(code + "\n\n" + harness)
            temp_path = f.name

        try:
            jac_cmd = self._get_jac_cmd()
            result = subprocess.run(
                [jac_cmd, "test", temp_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode == 0, result.stdout + result.stderr

        except subprocess.TimeoutExpired:
            return False, "Functional test timed out"
        except Exception as e:
            return False, f"Functional test failed to run: {str(e)}"
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass

    def evaluate_code(self, code: str, test_case: Dict, use_jac_check: bool = True) -> Dict:
        """Evaluate generated code against test requirements with strict validation"""
        score = 0
        max_score = test_case["points"]
        passed_checks = []
        failed_checks = []
        
        penalties = {
            "required": 0.0,
            "forbidden": 0.0,
            "syntax": 0.0,
            "jac_check": 0.0,
            "functional": 0.0
        }
        
        syntax_errors = 0

        required_found = 0
        for element in test_case["required_elements"]:
            found = SyntaxChecker.validate_element_strict(code, element)
            if found:
                required_found += 1
                passed_checks.append(f"[PASS] Found required element: '{element}'")
            else:
                failed_checks.append(f"[FAIL] Missing required element: '{element}'")

        forbidden_found = 0
        for element in test_case.get("forbidden_elements", []):
            if element in code:
                forbidden_found += 1
                failed_checks.append(f"[FAIL] Contains forbidden element: '{element}'")
            else:
                passed_checks.append(f"[PASS] Correctly avoided: '{element}'")

        total_required = len(test_case["required_elements"])
        total_forbidden = len(test_case.get("forbidden_elements", []))

        if total_required > 0:
            required_score = (required_found / total_required) * max_score
            penalties["required"] = max_score - required_score
        else:
            required_score = max_score

        if total_forbidden > 0:
            forbidden_penalty = (forbidden_found / total_forbidden) * (max_score * 0.4)
            penalties["forbidden"] = forbidden_penalty
        else:
            forbidden_penalty = 0

        score = max(0, required_score - forbidden_penalty)

        # Legacy syntax checks
        syntax_checks = SyntaxChecker.check_syntax(code)
        
        # jac check validation (50% penalty for invalid syntax)
        jac_valid = True
        jac_errors = []
        jac_warnings = []
        if use_jac_check:
            jac_valid, jac_errors, jac_warnings = self.jac_check(code)
            if not jac_valid:
                jac_penalty = max_score * 0.50
                penalties["jac_check"] = jac_penalty
                score = max(0, score - jac_penalty)
                failed_checks.append(f"[FAIL] jac check failed: {len(jac_errors)} errors")
            else:
                passed_checks.append("[PASS] jac check passed")
        else:
            # Only apply heuristic syntax penalty if jac check is not used
            syntax_errors = len([c for c in syntax_checks if c.startswith('[WARN]')])
            syntax_penalty = min(syntax_errors * 0.10 * max_score, max_score * 0.50)
            penalties["syntax"] = syntax_penalty
            score = max(0, score - syntax_penalty)

        # Functional Testing
        if test_case.get("type") == "functional":
            harness = test_case.get("test_harness", "")
            # Only run functional tests if basic compilation passed (or wasn't checked)
            if jac_valid:
                func_passed, func_output = self.run_functional_test(code, harness)
                if func_passed:
                    passed_checks.append("[PASS] Functional tests passed")
                else:
                    # If functional tests fail, lose remaining points (or specific amount)
                    # Current strategy: Functional correctness is paramount. 
                    # If it fails, deduct substantial points, e.g., remaining score.
                    # Let's say functional failure deducts 50% of max_score or resets score to 0?
                    # To be consistent with "fluctuations", let's apply a penalty rather than zeroing.
                    # If logic is wrong, code is not useful.
                    # Let's penalize remaining score.
                    func_penalty = score  # Wipe out remaining score if functionality fails
                    penalties["functional"] = func_penalty
                    score = 0
                    failed_checks.append(f"[FAIL] Functional tests failed:\n{func_output[:500]}...") # Truncate output
            else:
                # If compilation failed, functional test is skipped and penalized implicitly 
                # (score already reduced, maybe we should explicit fail functional too?)
                # For now, assume if it doesn't compile, it's not functionally correct.
                # But we already deducted for jac_check. Should we double dip?
                # Yes, if it's a functional test case, it MUST work.
                func_penalty = score
                penalties["functional"] = func_penalty
                score = 0
                failed_checks.append("[FAIL] Functional tests skipped due to compilation error")

        return {
            "test_id": test_case["id"],
            "category": test_case["category"],
            "level": test_case["level"],
            "score": round(score, 2),
            "max_score": max_score,
            "score_breakdown": penalties,
            "percentage": round((score / max_score) * 100, 2),
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
        }

    def run_benchmark(self, responses_file: str) -> Dict:
        """Run benchmark on LLM responses from file - parallelized"""
        try:
            with open(responses_file, 'r') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in '{responses_file}' at line {e.lineno}: {e.msg}")
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: '{responses_file}'")

        if "metadata" in data and "responses" in data:
            metadata = data["metadata"]
            responses = data["responses"]
        else:
            responses = data
            metadata = {}

        results = []
        category_scores = {}
        level_scores = {}

        tasks = []
        for test_case in self.tests:
            test_id = test_case["id"]
            if test_id in responses:
                tasks.append((test_case, responses[test_id]))

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self._evaluate_single, tc, code): tc
                for tc, code in tasks
            }
            for future in as_completed(futures):
                result = future.result()
                results.append(result)

                category = result["category"]
                if category not in category_scores:
                    category_scores[category] = {
                        "score": 0, "max": 0, "count": 0,
                        "penalties": {"required": 0, "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0}
                    }
                category_scores[category]["score"] += result["score"]
                category_scores[category]["max"] += result["max_score"]
                category_scores[category]["count"] += 1

                breakdown = result.get("score_breakdown", {})
                for k, v in breakdown.items():
                    category_scores[category]["penalties"][k] += v

                level = result["level"]
                if level not in level_scores:
                    level_scores[level] = {"score": 0, "max": 0, "count": 0}
                level_scores[level]["score"] += result["score"]
                level_scores[level]["max"] += result["max_score"]
                level_scores[level]["count"] += 1

        total_score = sum(r["score"] for r in results)
        total_max = sum(r["max_score"] for r in results)
        overall_percentage = (total_score / total_max * 100) if total_max > 0 else 0

        return {
            "results": results,
            "summary": {
                "total_score": round(total_score, 2),
                "total_max": total_max,
                "overall_percentage": round(overall_percentage, 2),
                "tests_completed": len(results),
                "tests_total": len(self.tests),
                "category_breakdown": {
                    cat: {
                        "score": round(scores["score"], 2),
                        "max": scores["max"],
                        "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                        "count": scores["count"],
                        "penalties": {k: round(v, 2) for k, v in scores["penalties"].items()}
                    }
                    for cat, scores in category_scores.items()
                },
                "level_breakdown": {
                    f"Level {level}": {
                        "score": round(scores["score"], 2),
                        "max": scores["max"],
                        "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                        "count": scores["count"]
                    }
                    for level, scores in sorted(level_scores.items())
                }
            }
        }

    def _evaluate_single(self, test_case: Dict, code: str) -> Dict:
        """Evaluate a single test case (for parallel execution)"""
        patched_code, _ = patch_missing_braces(code)
        return self.evaluate_code(patched_code, test_case)

    def evaluate_responses(self, responses: Dict[str, str], test_ids: List[str] = None) -> Dict[str, Any]:
        """Evaluate a dictionary of test responses (for API use) - parallelized

        Args:
            responses: Dictionary mapping test_id to code
            test_ids: Optional list of test IDs to filter evaluation to
        """
        results = []
        category_scores = {}
        level_scores = {}

        test_ids_set = set(test_ids) if test_ids else None

        tasks = []
        missing_tests = []
        for test_case in self.tests:
            test_id = test_case["id"]
            if test_ids_set and test_id not in test_ids_set:
                continue
            if test_id in responses:
                tasks.append((test_case, responses[test_id]))
            else:
                missing_tests.append(test_case)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self._evaluate_single, tc, code): tc
                for tc, code in tasks
            }
            for future in as_completed(futures):
                result = future.result()
                results.append(result)

                category = result["category"]
                if category not in category_scores:
                    category_scores[category] = {
                        "score": 0, "max": 0, "count": 0,
                        "penalties": {"required": 0, "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0}
                    }
                category_scores[category]["score"] += result["score"]
                category_scores[category]["max"] += result["max_score"]
                category_scores[category]["count"] += 1

                breakdown = result.get("score_breakdown", {})
                for k, v in breakdown.items():
                    category_scores[category]["penalties"][k] += v

                level = result["level"]
                if level not in level_scores:
                    level_scores[level] = {"score": 0, "max": 0, "count": 0}
                level_scores[level]["score"] += result["score"]
                level_scores[level]["max"] += result["max_score"]
                level_scores[level]["count"] += 1

        for test_case in missing_tests:
            missing_result = {
                "test_id": test_case["id"],
                "category": test_case["category"],
                "level": test_case["level"],
                "score": 0,
                "max_score": test_case["points"],
                "score_breakdown": {"required": test_case["points"], "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0},
                "percentage": 0,
                "required_found": "0/0",
                "forbidden_found": 0,
                "passed_checks": [],
                "failed_checks": ["[FAIL] No response generated for this test"],
                "syntax_feedback": [],
                "syntax_errors": 0,
                "jac_valid": False,
                "jac_errors": ["No code to check"],
                "jac_warnings": [],
                "code": ""
            }
            results.append(missing_result)

            category = test_case["category"]
            if category not in category_scores:
                category_scores[category] = {
                    "score": 0, "max": 0, "count": 0,
                    "penalties": {"required": 0, "forbidden": 0, "syntax": 0, "jac_check": 0, "functional": 0}
                }
            category_scores[category]["max"] += test_case["points"]
            category_scores[category]["count"] += 1
            category_scores[category]["penalties"]["required"] += test_case["points"]

            level = test_case["level"]
            if level not in level_scores:
                level_scores[level] = {"score": 0, "max": 0, "count": 0}
            level_scores[level]["max"] += test_case["points"]
            level_scores[level]["count"] += 1

        total_score = sum(r["score"] for r in results)
        total_max = sum(r["max_score"] for r in results)
        overall_percentage = (total_score / total_max * 100) if total_max > 0 else 0

        return {
            "evaluation_results": {
                cat: {
                    "score": round(scores["score"], 2),
                    "max": scores["max"],
                    "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                    "count": scores["count"],
                    "penalties": {k: round(v, 2) for k, v in scores["penalties"].items()},
                    "tests": [r for r in results if r["category"] == cat]
                }
                for cat, scores in category_scores.items()
            },
            "level_breakdown": {
                f"Level {level}": {
                    "score": round(scores["score"], 2),
                    "max": scores["max"],
                    "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                    "count": scores["count"]
                }
                for level, scores in sorted(level_scores.items())
            },
            "total_score": round(total_score, 2),
            "max_score": total_max,
            "percentage": round(overall_percentage, 2),
            "tests_completed": len(results),
            "tests_missing": len(missing_tests)
        }

    def get_test_stats(self) -> Dict[str, Any]:
        """Get statistics about test cases"""
        level_stats = {}
        category_stats = {}

        for test in self.tests:
            level = test['level']
            category = test['category']

            if level not in level_stats:
                level_stats[level] = {'count': 0, 'points': 0}
            level_stats[level]['count'] += 1
            level_stats[level]['points'] += test['points']

            if category not in category_stats:
                category_stats[category] = {'count': 0, 'points': 0}
            category_stats[category]['count'] += 1
            category_stats[category]['points'] += test['points']

        total_points = sum(t['points'] for t in self.tests)

        return {
            'total_tests': len(self.tests),
            'total_points': total_points,
            'levels': level_stats,
            'categories': category_stats
        }
