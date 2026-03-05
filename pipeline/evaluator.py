"""Evaluate generated Jac code against test requirements."""

import os
import subprocess
import tempfile
from typing import Dict, List, Any, Tuple

from .syntax import validate_element, patch_missing_braces


class Evaluator:
    """Evaluates Jac code: jac check + required/forbidden element matching."""

    def jac_check(self, code: str) -> Tuple[bool, List[str], List[str]]:
        """Run jac check. Returns (is_valid, errors, warnings)."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jac', delete=False) as f:
            f.write(code)
            temp_path = f.name

        try:
            result = subprocess.run(
                ['jac', 'check', temp_path],
                capture_output=True, text=True, timeout=10
            )
            errors, warnings = [], []
            for line in (result.stdout + result.stderr).split('\n'):
                line = line.strip()
                if line.startswith('Error:') or ('error' in line.lower() and ':' in line):
                    errors.append(line)
                elif line.startswith('Warning:'):
                    warnings.append(line)
            return result.returncode == 0, errors, warnings
        except subprocess.TimeoutExpired:
            return False, ["Syntax check timed out"], []
        except FileNotFoundError:
            return True, [], ["jac command not found -- skipping validation"]
        except Exception as e:
            return False, [f"Syntax check failed: {e}"], []
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    def evaluate_single(self, code: str, test_case: Dict) -> Dict:
        """Evaluate one test response. Non-compiling code scores 0."""
        patched_code, _ = patch_missing_braces(code)
        max_score = test_case["points"]
        passed_checks, failed_checks = [], []
        penalties = {"required": 0.0, "forbidden": 0.0, "jac_check": 0.0, "functional": 0.0}

        required_found = 0
        for element in test_case["required_elements"]:
            if validate_element(patched_code, element):
                required_found += 1
                passed_checks.append(f"[PASS] Found: '{element}'")
            else:
                failed_checks.append(f"[FAIL] Missing: '{element}'")

        forbidden_found = 0
        for element in test_case.get("forbidden_elements", []):
            if element in patched_code:
                forbidden_found += 1
                failed_checks.append(f"[FAIL] Contains forbidden: '{element}'")

        total_required = len(test_case["required_elements"])
        total_forbidden = len(test_case.get("forbidden_elements", []))

        required_score = (required_found / total_required * max_score) if total_required > 0 else max_score
        penalties["required"] = max_score - required_score

        forbidden_penalty = (forbidden_found / total_forbidden * max_score * 0.4) if total_forbidden > 0 else 0
        penalties["forbidden"] = forbidden_penalty

        score = max(0, required_score - forbidden_penalty)

        jac_valid, jac_errors, jac_warnings = self.jac_check(patched_code)
        if not jac_valid:
            penalties["jac_check"] = score
            score = 0
            failed_checks.append(f"[FAIL] jac check failed: {len(jac_errors)} errors -- score zeroed")
        else:
            passed_checks.append("[PASS] jac check passed")

        if test_case.get("type") == "functional" and test_case.get("test_harness"):
            if jac_valid:
                func_ok = self._run_functional_test(patched_code, test_case["test_harness"])
                if func_ok:
                    passed_checks.append("[PASS] Functional tests passed")
                else:
                    penalties["functional"] = score
                    score = 0
                    failed_checks.append("[FAIL] Functional tests failed")
            else:
                penalties["functional"] = score
                score = 0
                failed_checks.append("[FAIL] Functional tests skipped (compilation error)")

        return {
            "test_id": test_case["id"],
            "category": test_case["category"],
            "level": test_case["level"],
            "score": round(score, 2),
            "max_score": max_score,
            "percentage": round((score / max_score) * 100, 2) if max_score else 0,
            "score_breakdown": penalties,
            "required_found": f"{required_found}/{total_required}",
            "forbidden_found": forbidden_found,
            "passed_checks": passed_checks,
            "failed_checks": failed_checks,
            "jac_valid": jac_valid,
            "jac_errors": jac_errors,
            "jac_warnings": jac_warnings,
            "code": patched_code,
        }

    def _run_functional_test(self, code: str, harness: str) -> bool:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jac', delete=False) as f:
            f.write(code + "\n\n" + harness)
            temp_path = f.name
        try:
            result = subprocess.run(
                ['jac', 'test', temp_path],
                capture_output=True, text=True, timeout=30
            )
            return result.returncode == 0
        except Exception:
            return False
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    def evaluate_all(self, responses: Dict[str, str], suite: List[Dict]) -> Dict[str, Any]:
        """Evaluate all responses against a suite. Returns full results JSON."""
        results = []
        category_scores: Dict[str, Dict] = {}
        level_scores: Dict[int, Dict] = {}

        suite_by_id = {t["id"]: t for t in suite}

        for test_case in suite:
            test_id = test_case["id"]
            code = responses.get(test_id, "")
            if code:
                result = self.evaluate_single(code, test_case)
            else:
                result = {
                    "test_id": test_id, "category": test_case["category"],
                    "level": test_case["level"], "score": 0,
                    "max_score": test_case["points"], "percentage": 0,
                    "score_breakdown": {"required": test_case["points"], "forbidden": 0, "jac_check": 0, "functional": 0},
                    "required_found": "0/0", "forbidden_found": 0,
                    "passed_checks": [], "failed_checks": ["[FAIL] No response"],
                    "jac_valid": False, "jac_errors": ["No code"], "jac_warnings": [],
                    "code": "",
                }
            results.append(result)

            cat = result["category"]
            if cat not in category_scores:
                category_scores[cat] = {"score": 0, "max": 0, "count": 0}
            category_scores[cat]["score"] += result["score"]
            category_scores[cat]["max"] += result["max_score"]
            category_scores[cat]["count"] += 1

            lvl = result["level"]
            if lvl not in level_scores:
                level_scores[lvl] = {"score": 0, "max": 0, "count": 0}
            level_scores[lvl]["score"] += result["score"]
            level_scores[lvl]["max"] += result["max_score"]
            level_scores[lvl]["count"] += 1

        total_score = sum(r["score"] for r in results)
        total_max = sum(r["max_score"] for r in results)
        jac_passed = sum(1 for r in results if r.get("jac_valid"))

        return {
            "total_score": round(total_score, 2),
            "max_score": total_max,
            "percentage": round(total_score / total_max * 100, 2) if total_max else 0,
            "jac_check_pass_rate": round(jac_passed / len(results) * 100, 2) if results else 0,
            "tests_total": len(suite),
            "tests_responded": sum(1 for r in results if r["code"]),
            "category_breakdown": {
                cat: {
                    "score": round(s["score"], 2),
                    "max": s["max"],
                    "percentage": round(s["score"] / s["max"] * 100, 2) if s["max"] else 0,
                    "count": s["count"],
                }
                for cat, s in sorted(category_scores.items())
            },
            "level_breakdown": {
                f"L{lvl}": {
                    "score": round(s["score"], 2),
                    "max": s["max"],
                    "percentage": round(s["score"] / s["max"] * 100, 2) if s["max"] else 0,
                    "count": s["count"],
                }
                for lvl, s in sorted(level_scores.items())
            },
            "results": results,
        }
