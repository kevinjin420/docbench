"""Jac code validation service using jaclang."""

import os
import re
import subprocess
import tempfile
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of validating a single response."""
    test_id: str
    is_valid_syntax: bool
    syntax_errors: List[str]
    syntax_warnings: List[str]
    required_matches: Dict[str, bool]
    forbidden_matches: Dict[str, bool]
    regex_matches: Dict[str, bool]
    score: float
    max_score: float
    penalties: Dict[str, float]


class JacValidator:
    """Validates Jac code responses using multiple evaluation mechanisms."""

    def __init__(self, tests: List[Dict]):
        self.tests = {t['id']: t for t in tests if 'id' in t}

    def validate_response(self, test_id: str, code: str) -> ValidationResult:
        """
        Validate a single code response against its test criteria.

        Evaluation mechanisms:
        1. Syntax validation via jac check (pass/fail + penalty)
        2. Required elements (string contains)
        3. Forbidden elements (string not contains)
        4. Regex pattern matching
        """
        test = self.tests.get(test_id)
        if not test:
            return ValidationResult(
                test_id=test_id,
                is_valid_syntax=False,
                syntax_errors=[f"Unknown test ID: {test_id}"],
                syntax_warnings=[],
                required_matches={},
                forbidden_matches={},
                regex_matches={},
                score=0,
                max_score=0,
                penalties={"unknown_test": 1.0}
            )

        max_score = test.get('points', 10)
        penalties = {}

        # 1. Syntax validation
        is_valid, errors, warnings = self.check_syntax(code)
        if not is_valid:
            penalties['syntax_error'] = 0.5  # 50% penalty for syntax errors

        # 2. Required elements
        required = test.get('required_elements', [])
        required_matches = {}
        for elem in required:
            required_matches[elem] = elem in code
        missing_required = sum(1 for v in required_matches.values() if not v)
        if missing_required > 0:
            penalties['missing_required'] = (missing_required / len(required)) * 0.4 if required else 0

        # 3. Forbidden elements
        forbidden = test.get('forbidden_elements', [])
        forbidden_matches = {}
        for elem in forbidden:
            forbidden_matches[elem] = elem in code
        found_forbidden = sum(1 for v in forbidden_matches.values() if v)
        if found_forbidden > 0:
            penalties['forbidden_found'] = (found_forbidden / len(forbidden)) * 0.3 if forbidden else 0

        # 4. Regex patterns
        regex_patterns = test.get('regex_patterns', [])
        regex_matches = {}
        for pattern in regex_patterns:
            try:
                regex_matches[pattern] = bool(re.search(pattern, code, re.MULTILINE))
            except re.error:
                regex_matches[pattern] = False
        missing_patterns = sum(1 for v in regex_matches.values() if not v)
        if missing_patterns > 0 and regex_patterns:
            penalties['missing_patterns'] = (missing_patterns / len(regex_patterns)) * 0.2

        # Calculate final score
        total_penalty = min(1.0, sum(penalties.values()))
        score = max_score * (1 - total_penalty)

        return ValidationResult(
            test_id=test_id,
            is_valid_syntax=is_valid,
            syntax_errors=errors,
            syntax_warnings=warnings,
            required_matches=required_matches,
            forbidden_matches=forbidden_matches,
            regex_matches=regex_matches,
            score=round(score, 2),
            max_score=max_score,
            penalties=penalties
        )

    def check_syntax(self, code: str) -> Tuple[bool, List[str], List[str]]:
        """
        Run jac check on code and return (is_valid, errors, warnings).
        """
        errors = []
        warnings = []

        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.jac', delete=False
        ) as f:
            f.write(code)
            temp_path = f.name

        try:
            result = subprocess.run(
                ['jac', 'check', temp_path],
                capture_output=True,
                text=True,
                timeout=10
            )

            output = result.stdout + result.stderr

            # Parse errors and warnings from output
            for line in output.split('\n'):
                line = line.strip()
                if line.startswith('Error:'):
                    errors.append(line)
                elif line.startswith('Warning:'):
                    warnings.append(line)
                elif 'error' in line.lower() and ':' in line:
                    errors.append(line)

            is_valid = result.returncode == 0

        except subprocess.TimeoutExpired:
            errors.append("Syntax check timed out")
            is_valid = False
        except FileNotFoundError:
            errors.append("jac command not found - jaclang not installed")
            is_valid = True  # Don't penalize if jac not available
        except Exception as e:
            errors.append(f"Syntax check failed: {str(e)}")
            is_valid = False
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass

        return is_valid, errors, warnings

    def validate_all_responses(
        self,
        responses: Dict[str, str]
    ) -> Dict[str, ValidationResult]:
        """Validate all responses and return results by test_id."""
        results = {}
        for test_id, code in responses.items():
            results[test_id] = self.validate_response(test_id, code)
        return results

    def generate_report(
        self,
        results: Dict[str, ValidationResult]
    ) -> Dict:
        """Generate a summary report from validation results."""
        total_score = sum(r.score for r in results.values())
        max_score = sum(r.max_score for r in results.values())

        syntax_valid = sum(1 for r in results.values() if r.is_valid_syntax)
        syntax_invalid = len(results) - syntax_valid

        # Group by category
        by_category = {}
        for test_id, result in results.items():
            test = self.tests.get(test_id, {})
            category = test.get('category', 'Unknown')
            if category not in by_category:
                by_category[category] = {
                    'score': 0,
                    'max': 0,
                    'count': 0,
                    'syntax_errors': 0
                }
            by_category[category]['score'] += result.score
            by_category[category]['max'] += result.max_score
            by_category[category]['count'] += 1
            if not result.is_valid_syntax:
                by_category[category]['syntax_errors'] += 1

        # Group by level
        by_level = {}
        for test_id, result in results.items():
            test = self.tests.get(test_id, {})
            level = test.get('level', 0)
            if level not in by_level:
                by_level[level] = {
                    'score': 0,
                    'max': 0,
                    'count': 0,
                    'syntax_errors': 0
                }
            by_level[level]['score'] += result.score
            by_level[level]['max'] += result.max_score
            by_level[level]['count'] += 1
            if not result.is_valid_syntax:
                by_level[level]['syntax_errors'] += 1

        return {
            'total_score': round(total_score, 2),
            'max_score': max_score,
            'percentage': round((total_score / max_score) * 100, 2) if max_score else 0,
            'tests_evaluated': len(results),
            'syntax_valid': syntax_valid,
            'syntax_invalid': syntax_invalid,
            'syntax_pass_rate': round((syntax_valid / len(results)) * 100, 2) if results else 0,
            'by_category': {
                cat: {
                    'score': round(data['score'], 2),
                    'max': data['max'],
                    'percentage': round((data['score'] / data['max']) * 100, 2) if data['max'] else 0,
                    'count': data['count'],
                    'syntax_errors': data['syntax_errors']
                }
                for cat, data in by_category.items()
            },
            'by_level': {
                level: {
                    'score': round(data['score'], 2),
                    'max': data['max'],
                    'percentage': round((data['score'] / data['max']) * 100, 2) if data['max'] else 0,
                    'count': data['count'],
                    'syntax_errors': data['syntax_errors']
                }
                for level, data in sorted(by_level.items())
            }
        }
