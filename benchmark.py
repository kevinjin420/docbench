#!/usr/bin/env python3
# Usage: ./benchmark.py [eval FILE | eval-all | gen | stats | stash | clean | compare DIR1 DIR2] - Jac language LLM benchmark suite

import json
import re
import sys
import glob
import time
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
import os

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, will use system environment variables

try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    print("Warning: litellm not installed. Install with: pip install litellm")
    print("LLM benchmarking features will not be available.")
class JacBenchmark:
    """Benchmark suite for testing LLM Jac code generation"""

    def __init__(self):
        self.tests = self.load_test_cases()
        self.results = []

    def load_test_cases(self) -> List[Dict]:
        """Load test cases from external JSON file"""
        tests_file = Path(__file__).parent / "tests.json"
        with open(tests_file, 'r') as f:
            return json.load(f)

    def evaluate_code(self, code: str, test_case: Dict) -> Dict:
        """Evaluate generated code against test requirements with strict validation"""
        score = 0
        max_score = test_case["points"]
        feedback = []
        passed_checks = []
        failed_checks = []

        # Check for required elements with stricter pattern-based validation
        required_found = 0
        for element in test_case["required_elements"]:
            found = self._validate_element_strict(code, element)
            if found:
                required_found += 1
                passed_checks.append(f"[PASS] Found required element: '{element}'")
            else:
                failed_checks.append(f"[FAIL] Missing required element: '{element}'")

        # Check for forbidden elements
        forbidden_found = 0
        for element in test_case["forbidden_elements"]:
            if element in code:
                forbidden_found += 1
                failed_checks.append(f"[FAIL] Contains forbidden element: '{element}'")
            else:
                passed_checks.append(f"[PASS] Correctly avoided: '{element}'")

        # Calculate score
        total_required = len(test_case["required_elements"])
        total_forbidden = len(test_case["forbidden_elements"])

        if total_required > 0:
            required_score = (required_found / total_required) * max_score
        else:
            required_score = max_score

        if total_forbidden > 0:
            forbidden_penalty = (forbidden_found / total_forbidden) * (max_score * 0.3)
        else:
            forbidden_penalty = 0

        score = max(0, required_score - forbidden_penalty)

        # Additional syntax checks with heavier penalties
        syntax_checks = self.check_syntax(code)
        feedback.extend(syntax_checks)

        # Apply syntax error penalty (10% per error, up to 50% total)
        syntax_errors = len([c for c in syntax_checks if c.startswith('[WARN]')])
        syntax_penalty = min(syntax_errors * 0.10 * max_score, max_score * 0.50)
        score = max(0, score - syntax_penalty)

        return {
            "test_id": test_case["id"],
            "category": test_case["category"],
            "level": test_case["level"],
            "score": round(score, 2),
            "max_score": max_score,
            "percentage": round((score / max_score) * 100, 2),
            "required_found": f"{required_found}/{total_required}",
            "forbidden_found": forbidden_found,
            "passed_checks": passed_checks,
            "failed_checks": failed_checks,
            "syntax_feedback": syntax_checks,
            "syntax_errors": syntax_errors,
            "code": code
        }

    def _validate_element_strict(self, code: str, element: str) -> bool:
        """
        Strictly validate element presence with context-aware pattern matching.
        Returns True only if element appears in proper syntactic context.
        """
        # Normalize whitespace for consistent matching
        code_normalized = ' '.join(code.split())

        # Define strict validation patterns for common Jac keywords
        strict_patterns = {
            'walker': r'\bwalker\s+\w+\s*\{',  # walker must have name and opening brace
            'node': r'\bnode\s+\w+\s*\{',      # node must have name and opening brace
            'edge': r'\bedge\s+\w+\s*\{',      # edge must have name and opening brace
            'obj': r'\bobj\s+\w+\s*\{',        # obj must have name and opening brace
            'enum': r'\benum\s+\w+\s*\{',      # enum must have name and opening brace
            'has': r'\bhas\s+\w+\s*:\s*\w+',   # has must have type annotation
            'can': r'\bcan\s+\w+\s+with\s+',   # can must have 'with' clause
            'with entry': r'\bwith\s+entry\s*\{',  # with entry must have block
            'with exit': r'\bwith\s+exit\s*\{',    # with exit must have block
            'visit': r'\bvisit\s+[^\s;]+',     # visit must have target
            'spawn': r'\bspawn\s+\w+\s*\(',    # spawn must have walker call
            'by llm': r'\bby\s+llm\s*\(',      # by llm must have parentheses
            'import': r'\bimport\s+',          # import statement
            'from': r'\bfrom\s+\w+\s*\{',      # from import with braces
            'return': r'\breturn\s+',          # return statement
            'report': r'\breport\s+',          # report statement
            'def': r'\bdef\s+\w+\s*\(',        # function must have name and params
            'async': r'\basync\s+(walker|def)', # async must be before walker/def
            '__specs__': r'\bobj\s+__specs__\s*\{', # __specs__ must be in obj block
            'socket.notify': r'socket\.notify(_channels)?\s*\(',  # socket notify call
            'here': r'\bhere\s*\.',            # here reference
            'self': r'\bself\s*\.',            # self reference
            '-[': r'-\[\w+\]\->', # edge traversal syntax
            '-->': r'-->', # forward edge traversal
            '<--': r'<--', # backward edge traversal
        }

        # Try strict pattern first if defined
        if element in strict_patterns:
            pattern = strict_patterns[element]
            if re.search(pattern, code):
                return True
            # If strict pattern not found, return False (no fallback)
            return False

        # For elements with specific patterns, use stricter matching
        if ':' in element and 'has' not in code:
            # Type annotation required but 'has' not found
            return False

        if element.startswith('def ') and 'def' in code:
            # Function definition - require proper structure
            func_name = element.split()[1] if len(element.split()) > 1 else None
            if func_name:
                pattern = rf'\bdef\s+{re.escape(func_name)}\s*\([^)]*\)'
                return bool(re.search(pattern, code))

        # For walker/node/edge names, require proper declaration
        for keyword in ['walker', 'node', 'edge', 'obj', 'enum']:
            if element.startswith(keyword + ' '):
                name = element.split()[1] if len(element.split()) > 1 else None
                if name:
                    pattern = rf'\b{keyword}\s+{re.escape(name)}\s*\{{'
                    return bool(re.search(pattern, code))

        # Check for method calls - require parentheses
        if '.' in element and '(' not in element:
            # Method name without parentheses in element - require it in code
            method_pattern = re.escape(element) + r'\s*\('
            if re.search(method_pattern, code):
                return True
            return False

        # Check for attribute access - require it to be complete
        if element.count('.') == 1 and '(' not in element:
            # Attribute access like "self.name" - be stricter
            parts = element.split('.')
            if len(parts) == 2:
                pattern = rf'\b{re.escape(parts[0])}\.{re.escape(parts[1])}\b'
                return bool(re.search(pattern, code))

        # For string literals, require exact match with quotes
        if element.startswith('"') or element.startswith("'"):
            return element in code

        # For operators and special symbols, require as-is
        if element in ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '**', '//',
                       '<<', '>>', '&', '|', '^', '~', 'and', 'or', 'not', 'in', 'is']:
            return element in code

        # Fallback: simple substring match for generic elements
        # But still require word boundaries for identifiers
        if element.replace('_', '').isalnum():
            # It's an identifier - require word boundaries
            pattern = rf'\b{re.escape(element)}\b'
            return bool(re.search(pattern, code))
        else:
            # Non-identifier - simple substring match
            return element in code

    def patch_missing_braces(self, code: str) -> tuple[str, bool]:
        """
        Patch missing closing braces/brackets/parentheses at the end of code.
        LLMs often truncate the final closing brace.
        Returns: (patched_code, was_patched)
        """
        was_patched = False
        original_code = code

        # Count all types of brackets
        open_braces = code.count('{')
        close_braces = code.count('}')
        open_brackets = code.count('[')
        close_brackets = code.count(']')
        open_parens = code.count('(')
        close_parens = code.count(')')

        # Patch missing closing braces (most common issue)
        if open_braces > close_braces:
            missing = open_braces - close_braces
            code = code + '\n' + '}' * missing
            was_patched = True

        # Patch missing closing brackets
        if open_brackets > close_brackets:
            missing = open_brackets - close_brackets
            code = code + ']' * missing
            was_patched = True

        # Patch missing closing parentheses
        if open_parens > close_parens:
            missing = open_parens - close_parens
            code = code + ')' * missing
            was_patched = True

        return code, was_patched

    def check_syntax(self, code: str) -> List[str]:
        """Enhanced syntax validation checks for Jac code"""
        checks = []

        # Check for basic Jac syntax patterns
        if re.search(r'\bwith entry\b', code) and not re.search(r'with entry\s*{', code):
            checks.append("[WARN] 'with entry' should be followed by a block { }")

        if re.search(r'\bwith exit\b', code) and not re.search(r'with exit\s*{', code):
            checks.append("[WARN] 'with exit' should be followed by a block { }")

        # Check for walker/node/edge/obj/enum declarations
        for keyword in ['walker', 'node', 'edge', 'obj', 'enum']:
            if re.search(rf'\b{keyword}\s+\w+\b', code):
                # Found keyword with name, check for opening brace
                if not re.search(rf'\b{keyword}\s+\w+\s*{{', code):
                    checks.append(f"[WARN] '{keyword}' declaration should be followed by opening brace {{")

        # Check for ability declarations
        if re.search(r'\bcan\s+\w+\b', code):
            if not re.search(r'\bcan\s+\w+\s+with\s+', code):
                checks.append("[WARN] 'can' ability should include 'with' clause (e.g., 'can ability_name with entry')")

        # Check for visit statements
        if re.search(r'\bvisit\b(?!\s+[^\s;]+)', code):
            checks.append("[WARN] 'visit' should be followed by a target")

        # Check for spawn statements
        if re.search(r'\bspawn\b', code) and not re.search(r'\bspawn\s+\w+\s*\(', code):
            checks.append("[WARN] 'spawn' should be followed by walker name and parentheses")

        # Check for by llm syntax
        if re.search(r'\bby\s+llm\b', code) and not re.search(r'\bby\s+llm\s*\(', code):
            checks.append("[WARN] 'by llm' should be followed by parentheses (e.g., 'by llm()')")

        # Check for has declarations without type annotations
        if re.search(r'\bhas\s+\w+\s*[=;]', code):
            if not re.search(r'\bhas\s+\w+\s*:\s*\w+', code):
                checks.append("[WARN] 'has' attributes should have type annotations (e.g., 'has name: str')")

        # Check for proper async usage
        if re.search(r'\basync\b', code):
            if not re.search(r'\basync\s+(walker|def)\b', code):
                checks.append("[WARN] 'async' should be used before 'walker' or 'def'")

        # Check for proper braces
        open_braces = code.count('{')
        close_braces = code.count('}')
        if open_braces != close_braces:
            checks.append(f"[WARN] Mismatched braces: {open_braces} opening, {close_braces} closing")

        # Check for brackets balance
        open_brackets = code.count('[')
        close_brackets = code.count(']')
        if open_brackets != close_brackets:
            checks.append(f"[WARN] Mismatched brackets: {open_brackets} opening, {close_brackets} closing")

        # Check for parentheses balance
        open_parens = code.count('(')
        close_parens = code.count(')')
        if open_parens != close_parens:
            checks.append(f"[WARN] Mismatched parentheses: {open_parens} opening, {close_parens} closing")

        # Check for semicolons
        lines = code.split('\n')
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or stripped.startswith('*#'):
                continue

            # Check if statement line needs semicolon
            needs_semi = any(keyword in stripped for keyword in [
                'glob ', 'has ', 'print(', 'report ', 'import ', 'include ',
                'disengage', 'raise ', 'return ', 'break', 'continue'
            ])

            # Lines that don't need semicolons
            no_semi_start = ('def ', 'obj ', 'node ', 'edge ', 'walker ', 'enum ',
                            'can ', 'if ', 'elif ', 'else', 'for ', 'while ',
                            'try', 'except', 'match ', 'case ', 'async def',
                            'with ', 'class ')
            no_semi_end = ('{', '}', ':', ',', '\\')

            # Assignment that's not in a declaration
            has_assignment = '=' in stripped and not stripped.startswith(no_semi_start)

            if (needs_semi or has_assignment) and not stripped.startswith(no_semi_start):
                if not stripped.endswith(no_semi_end) and not stripped.endswith(';'):
                    checks.append(f"[WARN] Line {i} may be missing semicolon: {stripped[:60]}")

        # Check for type annotations on attributes
        if re.search(r'has\s+\w+\s*=', code) and not re.search(r'has\s+\w+\s*:\s*\w+', code):
            checks.append("[WARN] Attributes should have type annotations (has name: type)")

        # Check for type annotations on function parameters
        if re.search(r'def\s+\w+\s*\([^)]*\w+\s*\)', code):
            if not re.search(r'def\s+\w+\s*\([^)]*:\s*\w+', code):
                checks.append("[WARN] Function parameters should have type annotations")

        # Check for return type annotations
        if 'def ' in code and 'return' in code:
            if not re.search(r'def\s+\w+[^{]*->\s*\w+', code):
                checks.append("[WARN] Functions with return statements should have return type annotations (-> type)")

        # Check for proper node/edge/walker syntax
        if re.search(r'\bnode\s+\w+\s+\w+', code):
            checks.append("[WARN] Node declaration should use 'node ClassName {' syntax")

        if re.search(r'\bedge\s+\w+\s+\w+', code):
            checks.append("[WARN] Edge declaration should use 'edge ClassName {' syntax")

        if re.search(r'\bwalker\s+\w+\s+\w+', code):
            checks.append("[WARN] Walker declaration should use 'walker ClassName {' syntax")

        # Check for proper connection operators
        if '-->' in code and not any(op in code for op in ['[-->', '-->]', '++>', '+>:']):
            checks.append("[WARN] Navigation operator '-->' should be used in visit statements with brackets")

        # Check for proper visit syntax
        if 'visit' in code and not re.search(r'visit\s+\[', code):
            checks.append("[WARN] Visit statements should use bracket notation: visit [...]")

        # Check for proper global access
        if 'glob ' in code and ':g:' not in code:
            checks.append("[WARN] Global variables should be accessed with :g: notation")

        # Check for proper backtick usage in filtering
        if '?' in code and '`?' not in code and 'visit' in code:
            checks.append("[WARN] Type filtering in visit should use backtick: `?Type")

        # Check for spawn syntax
        if 'spawn' in code and not re.search(r'(root|here|\w+)\s+spawn\s+\w+', code):
            checks.append("[WARN] Spawn should follow pattern: 'node spawn walker_instance'")

        # Check for ability syntax
        if 'can ' in code and 'with' in code:
            if not re.search(r'can\s+\w+\s+with\s+(entry|exit)', code):
                checks.append("[WARN] Abilities should use 'can ability_name with entry/exit' syntax")

        # Check for proper AI function syntax
        if 'by llm(' in code and 'def' in code:
            if not re.search(r'def\s+\w+[^{]*by\s+llm\(\)', code):
                checks.append("[WARN] AI functions should use 'def func() -> type by llm()' syntax")

        # Check for walker specs syntax
        if '__specs__' in code:
            if not re.search(r'obj\s+__specs__\s*{', code):
                checks.append("[WARN] Walker specs should use 'obj __specs__ { static has ... }' syntax")

        # Check for import syntax
        if re.search(r'import\s+\w+\s*(?!;|from)', code):
            checks.append("[WARN] Import statements should end with semicolon")

        # Check for proper edge connection syntax
        if any(op in code for op in ['++>', '<++>', '+>:', '<+:']):
            if not re.search(r'\w+\s*(-->|<-->|<--|\+\+>|<\+\+>|\+>:|<\+:)', code):
                checks.append("[WARN] Connection operators should be used between nodes")

        # Provide positive feedback for good practices
        good_practices = []
        if re.search(r'has\s+\w+\s*:\s*\w+', code):
            good_practices.append("[GOOD] Using type annotations on attributes")
        if re.search(r'def\s+\w+[^{]*->\s*\w+', code):
            good_practices.append("[GOOD] Using return type annotations")
        if re.search(r'with entry\s*{', code):
            good_practices.append("[GOOD] Proper entry block syntax")
        if re.search(r'visit\s+\[', code):
            good_practices.append("[GOOD] Correct visit statement syntax")

        # Add good practices to checks (optional, for feedback)
        # checks.extend(good_practices)

        return checks

    def run_benchmark(self, responses_file: str) -> Dict:
        """Run benchmark on LLM responses from file"""
        # Load responses
        try:
            with open(responses_file, 'r') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"\n{'='*70}")
            print(f"ERROR: Invalid JSON in '{responses_file}'")
            print(f"{'='*70}")
            print(f"\nJSON Parsing Error at line {e.lineno}, column {e.colno} (character {e.pos}):")
            print(f"  {e.msg}")
            print(f"\nCommon causes:")
            print(f"  - Trailing comma after last entry (not allowed in JSON)")
            print(f"  - Missing quotes around property names")
            print(f"  - Unescaped quotes or newlines in strings")
            print(f"  - Invalid escape sequences")
            print(f"\nTo debug:")
            print(f"  1. Check line {e.lineno} in the file")
            print(f"  2. Look for trailing commas before closing braces")
            print(f"  3. Validate JSON with: python3 -m json.tool {responses_file}")
            print(f"\n{'='*70}\n")
            raise SystemExit(1)
        except FileNotFoundError:
            print(f"\n{'='*70}")
            print(f"ERROR: File not found: '{responses_file}'")
            print(f"{'='*70}\n")
            raise SystemExit(1)

        # Handle both old format (direct responses) and new format (with metadata)
        if "metadata" in data and "responses" in data:
            metadata = data["metadata"]
            responses = data["responses"]
            print(f"\nBenchmark Metadata:")
            print(f"  Model: {metadata.get('model', 'N/A')} ({metadata.get('model_alias', 'N/A')})")
            print(f"  Variant: {metadata.get('variant', 'N/A')}")
            print(f"  Test Suite: {metadata.get('test_suite', 'N/A')} ({metadata.get('total_tests', 'N/A')} tests)")
            print(f"  Temperature: {metadata.get('temperature', 'N/A')}")
            print(f"  Max Tokens: {metadata.get('max_tokens', 'N/A')}")
        else:
            # Old format - just responses
            responses = data
            metadata = {}
            print(f"\n[WARN] Old format file without metadata")

        results = []
        category_scores = {}
        level_scores = {}
        patched_count = 0

        for test_case in self.tests:
            test_id = test_case["id"]
            if test_id in responses:
                code = responses[test_id]

                # Patch missing closing braces/brackets/parentheses
                patched_code, was_patched = self.patch_missing_braces(code)
                if was_patched:
                    patched_count += 1

                result = self.evaluate_code(patched_code, test_case)
                result["was_patched"] = was_patched
                results.append(result)

                # Track category scores
                category = test_case["category"]
                if category not in category_scores:
                    category_scores[category] = {"score": 0, "max": 0, "count": 0}
                category_scores[category]["score"] += result["score"]
                category_scores[category]["max"] += result["max_score"]
                category_scores[category]["count"] += 1

                # Track level scores
                level = test_case["level"]
                if level not in level_scores:
                    level_scores[level] = {"score": 0, "max": 0, "count": 0}
                level_scores[level]["score"] += result["score"]
                level_scores[level]["max"] += result["max_score"]
                level_scores[level]["count"] += 1

        # Calculate summary statistics
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
                "patched_count": patched_count,
                "category_breakdown": {
                    cat: {
                        "score": round(scores["score"], 2),
                        "max": scores["max"],
                        "percentage": round((scores["score"] / scores["max"] * 100) if scores["max"] > 0 else 0, 2),
                        "count": scores["count"]
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

    def generate_report(self, benchmark_results: Dict):
        """Generate summary report to stdout using Jinja template"""
        summary = benchmark_results["summary"]

        # Setup Jinja environment
        template_dir = Path(__file__).parent / 'templates'
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template('single_eval.md.jinja')

        # Render and print
        output = template.render(summary=summary)
        print(output)

class MultiDocEvaluator:
    """Evaluates multiple documentation test results and generates comparison report"""

    VARIANTS = ['mini', 'core']  # In increasing size order
    TESTS_DIR = Path('tests')
    REPORTS_DIR = TESTS_DIR / 'reports'
    RELEASE_DIR = Path('release')  # Original documentation files

    def __init__(self):
        self.results = {}
        self.file_sizes = {}
        # Create reports directory if it doesn't exist
        self.REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    def get_file_size(self, file_path: Path) -> int:
        """Get file size in bytes"""
        if file_path.exists():
            return file_path.stat().st_size
        return 0

    def find_variant_file(self, variant: str) -> Path | None:
        """Find test file containing variant keyword"""
        test_files = list(self.TESTS_DIR.glob("*.txt"))
        for file_path in test_files:
            if variant.lower() in file_path.name.lower():
                return file_path
        return None

    def run_benchmark(self, variant: str) -> Dict:
        """Run benchmark for a specific variant"""
        file_path = self.find_variant_file(variant)

        if not file_path:
            print(f"Warning: No file containing '{variant}' found in {self.TESTS_DIR}, skipping...")
            return None

        # Get file size from original documentation file in release/
        # Search for doc file containing variant keyword
        doc_files = list(self.RELEASE_DIR.glob("**/*.txt"))
        doc_file_path = None
        for doc_file in doc_files:
            if variant.lower() in doc_file.name.lower():
                doc_file_path = doc_file
                break

        file_size = self.get_file_size(doc_file_path) if doc_file_path else 0
        self.file_sizes[variant] = file_size

        # Run benchmark
        print(f"Evaluating {variant} ({file_path.name})...")
        try:
            benchmark = JacBenchmark()
            results = benchmark.run_benchmark(str(file_path))
            return results

        except json.JSONDecodeError as e:
            print(f"JSON error in {variant}: {e}")
            return None
        except Exception as e:
            print(f"Error evaluating {variant}: {e}")
            return None

    def check_all_files_exist(self) -> bool:
        """Check if all required test files exist"""
        missing = []
        for variant in self.VARIANTS:
            file_path = self.find_variant_file(variant)
            if not file_path:
                missing.append(variant)

        if missing:
            print("ERROR: Missing required test files:")
            for variant in missing:
                print(f"  - No file containing '{variant}' found in {self.TESTS_DIR}")
            print(f"\nAt least one file for each variant ({', '.join(self.VARIANTS)}) must be present.")
            return False
        return True

    def evaluate_all(self):
        """Evaluate all variants"""
        print("=" * 80)
        print("MULTI-DOCUMENTATION EVALUATION")
        print("=" * 80)
        print()

        # Find which variants have test files
        found_variants = []
        for variant in self.VARIANTS:
            if self.find_variant_file(variant):
                found_variants.append(variant)

        if not found_variants:
            print(f"ERROR: No test files found in {self.TESTS_DIR}")
            print(f"Looking for files containing: {', '.join(self.VARIANTS)}")
            sys.exit(1)

        print(f"Found test files for: {', '.join(found_variants)}")
        if len(found_variants) < len(self.VARIANTS):
            missing = set(self.VARIANTS) - set(found_variants)
            print(f"Skipping missing variants: {', '.join(missing)}")
        print()

        for variant in found_variants:
            result = self.run_benchmark(variant)
            if result:
                self.results[variant] = result

        print()

    def generate_comparison_report(self):
        """Generate comprehensive comparison report"""
        if not self.results:
            print("No results to report")
            return

        print("=" * 80)
        print("COMPARATIVE ANALYSIS REPORT")
        print("=" * 80)
        print()

        # Summary Table
        print("SUMMARY TABLE")
        print("-" * 80)
        print(f"{'Variant':<12} {'Size (bytes)':<14} {'Score':<12} {'Max':<6} {'%':<8} {'Score/KB':<12} {'Patched':<8}")
        print("-" * 80)

        summary_data = []
        for variant in self.VARIANTS:
            if variant in self.results:
                summary = self.results[variant]['summary']
                size = self.file_sizes[variant]
                score = summary['total_score']
                max_score = summary['total_max']
                percentage = summary['overall_percentage']
                score_per_kb = (score / (size / 1024)) if size > 0 else 0
                patched_count = summary.get('patched_count', 0)

                summary_data.append({
                    'variant': variant,
                    'size': size,
                    'score': score,
                    'max_score': max_score,
                    'percentage': percentage,
                    'score_per_kb': score_per_kb,
                    'patched_count': patched_count
                })

                print(f"{variant:<12} {size:<14} {score:<12.2f} {max_score:<6} {percentage:<8.2f} {score_per_kb:<12.2f} {patched_count:<8}")

        print()

        # Efficiency Rankings
        print("EFFICIENCY RANKINGS (Score per KB)")
        print("-" * 80)
        ranked = sorted(summary_data, key=lambda x: x['score_per_kb'], reverse=True)
        for i, data in enumerate(ranked, 1):
            print(f"{i}. {data['variant']:<12} {data['score_per_kb']:>8.2f} score/KB "
                  f"({data['score']:.2f}/{data['max_score']} points, {data['size']} bytes)")
        print()

        # Absolute Score Rankings
        print("ABSOLUTE SCORE RANKINGS")
        print("-" * 80)
        ranked_score = sorted(summary_data, key=lambda x: x['score'], reverse=True)
        for i, data in enumerate(ranked_score, 1):
            print(f"{i}. {data['variant']:<12} {data['score']:>8.2f}/{data['max_score']} "
                  f"({data['percentage']:.2f}%)")
        print()

        # Category Comparison
        print("CATEGORY PERFORMANCE COMPARISON")
        print("-" * 80)

        # Get all categories
        categories = set()
        for variant in self.results:
            categories.update(self.results[variant]['summary']['category_breakdown'].keys())

        for category in sorted(categories):
            print(f"\n{category}:")
            print(f"  {'Variant':<12} {'Score':<12} {'Max':<6} {'%':<8}")
            for variant in self.VARIANTS:
                if variant in self.results:
                    cat_data = self.results[variant]['summary']['category_breakdown'].get(category)
                    if cat_data:
                        print(f"  {variant:<12} {cat_data['score']:<12.2f} "
                              f"{cat_data['max']:<6} {cat_data['percentage']:<8.2f}")

        print()

        # Level Comparison
        print("DIFFICULTY LEVEL COMPARISON")
        print("-" * 80)

        # Get all levels
        levels = set()
        for variant in self.results:
            levels.update(self.results[variant]['summary']['level_breakdown'].keys())

        # Sort levels numerically by extracting the number
        def sort_level_key(level_str):
            # Extract number from "Level X" string
            import re
            match = re.search(r'(\d+)', level_str)
            return int(match.group(1)) if match else 0

        for level in sorted(levels, key=sort_level_key):
            print(f"\n{level}:")
            print(f"  {'Variant':<12} {'Score':<12} {'Max':<6} {'%':<8}")
            for variant in self.VARIANTS:
                if variant in self.results:
                    level_data = self.results[variant]['summary']['level_breakdown'].get(level)
                    if level_data:
                        print(f"  {variant:<12} {level_data['score']:<12.2f} "
                              f"{level_data['max']:<6} {level_data['percentage']:<8.2f}")

        print()

        # Size Analysis
        print("SIZE ANALYSIS")
        print("-" * 80)
        if self.file_sizes:
            total_size = sum(self.file_sizes.values())
            print(f"Total combined size: {total_size:,} bytes ({total_size/1024:.2f} KB)")
            print(f"\nSize distribution:")
            for variant in self.VARIANTS:
                if variant in self.file_sizes:
                    size = self.file_sizes[variant]
                    pct = (size / total_size * 100) if total_size > 0 else 0
                    print(f"  {variant:<12} {size:>8,} bytes ({pct:>5.1f}%)")

        print()

        # Best Performer Analysis
        print("BEST PERFORMER ANALYSIS")
        print("-" * 80)

        best_overall = max(summary_data, key=lambda x: x['score'])
        best_efficiency = max(summary_data, key=lambda x: x['score_per_kb'])
        smallest = min(summary_data, key=lambda x: x['size'])

        print(f"Highest Score:       {best_overall['variant']} ({best_overall['score']:.2f}/{best_overall['max_score']})")
        print(f"Most Efficient:      {best_efficiency['variant']} ({best_efficiency['score_per_kb']:.2f} score/KB)")
        print(f"Smallest Size:       {smallest['variant']} ({smallest['size']} bytes)")

        print()
        print("=" * 80)

        # Save detailed results to Markdown in reports directory
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = self.REPORTS_DIR / f"evaluation_report_{timestamp}.md"

        # Generate markdown report
        md_content = self.generate_markdown_report(summary_data, categories, levels)

        with open(output_file, 'w') as f:
            f.write(md_content)

        print(f"\nDetailed markdown report saved to: {output_file}")

        return timestamp

    def generate_markdown_report(self, summary_data: List[Dict], categories: set, levels: set) -> str:
        """Generate comprehensive markdown report using Jinja template"""
        # Setup Jinja environment
        template_dir = Path(__file__).parent / 'templates'
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template('multi_eval_report.md.jinja')

        # Prepare data for template
        total_size = sum(self.file_sizes.values())
        ranked_efficiency = sorted(summary_data, key=lambda x: x['score_per_kb'], reverse=True)
        ranked_score = sorted(summary_data, key=lambda x: x['score'], reverse=True)
        best_overall = max(summary_data, key=lambda x: x['score'])
        best_efficiency = max(summary_data, key=lambda x: x['score_per_kb'])
        smallest = min(summary_data, key=lambda x: x['size'])

        # Sort levels numerically
        def sort_level_key(level_str):
            # Extract number from "Level X" string
            match = re.search(r'(\d+)', level_str)
            return int(match.group(1)) if match else 0

        sorted_levels = sorted(levels, key=sort_level_key)

        # Render template
        return template.render(
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            summary_data=summary_data,
            ranked_efficiency=ranked_efficiency,
            ranked_score=ranked_score,
            categories=categories,
            levels=sorted_levels,
            variants=self.VARIANTS,
            results=self.results,
            file_sizes=self.file_sizes,
            total_size=total_size,
            best_overall=best_overall,
            best_efficiency=best_efficiency,
            smallest=smallest
        )

    def archive_results(self, timestamp: str):
        """Move test results to timestamped archive directory"""
        archive_dir = self.TESTS_DIR / timestamp
        archive_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nArchiving test results to {archive_dir}/")

        for variant in self.VARIANTS:
            file_name = f"test-llmdocs-jaseci-{variant}.txt"
            src = self.TESTS_DIR / file_name
            dst = archive_dir / file_name

            if src.exists():
                src.rename(dst)
                print(f"  Moved {file_name}")

        print("Archive complete!")



def generate_test_prompts(output_file: str = "test_prompts.json"):
    """Generate test prompts JSON file for LLM testing"""
    benchmark = JacBenchmark()
    
    prompts = {
        "instructions": """
# Jac Language LLM Benchmark - Test Instructions

You are being tested on your ability to write Jac code based on documentation.
For each test case, write ONLY the Jac code that solves the task.

## Important Rules:
1. Write complete, syntactically correct Jac code
2. Follow all Jac syntax conventions (semicolons, braces, type annotations)
3. Do NOT include explanations or markdown - ONLY code
4. Each response should be valid Jac code that could run
5. Pay attention to required elements mentioned in hints

## Response Format:
Your response file should be a JSON object where:
- Keys are test IDs (e.g., "basic_01", "walker_03")
- Values are the Jac code as strings

Example format:
{
    "basic_01": "with entry {\\n    print(\\"Hello, Jac!\\");\\n}",
    "basic_02": "glob counter: int = 0;\\n\\nwith entry {\\n    print(:g:counter);\\n}"
}

## Test Cases:
""",
        "tests": [
            {
                "id": test["id"],
                "level": test["level"],
                "category": test["category"],
                "task": test["task"],
                "points": test["points"],
                "hints": test["hints"]
            }
            for test in benchmark.tests
        ]
    }
    
    with open(output_file, 'w') as f:
        json.dump(prompts, f, indent=2)
    
    print(f"Generated test prompts: {output_file}")
    print(f"Total tests: {len(prompts['tests'])}")


def show_stats():
    """Show benchmark statistics"""
    benchmark = JacBenchmark()
    tests = benchmark.tests

    print(f'Total tests: {len(tests)}')
    print()
    print('Breakdown by level:')
    for level in range(1, 11):
        level_tests = [t for t in tests if t['level'] == level]
        total_points = sum(t['points'] for t in level_tests)
        print(f'  Level {level}: {len(level_tests)} tests, {total_points} points')

    print()
    print('Breakdown by category:')
    categories = {}
    for test in tests:
        cat = test['category']
        if cat not in categories:
            categories[cat] = {'count': 0, 'points': 0}
        categories[cat]['count'] += 1
        categories[cat]['points'] += test['points']

    for cat in sorted(categories.keys()):
        print(f'  {cat}: {categories[cat]["count"]} tests, {categories[cat]["points"]} points')

    print()
    total_points = sum(t['points'] for t in tests)
    print(f'Total possible points: {total_points}')


def parse_score_from_report(file_path: Path) -> Tuple[float | None, Dict[str, float]]:
    """
    Parses the total score and category scores from a benchmark report file.
    Returns: (total_score, category_scores_dict)
    """
    if not file_path.exists():
        return None, {}

    content = file_path.read_text()

    # Parse total score
    total_score = None
    match = re.search(r"Total Score:\s+([\d.]+)\/", content)
    if match:
        total_score = float(match.group(1))

    # Parse category scores
    category_scores = {}

    # Find the CATEGORY BREAKDOWN section
    category_section = re.search(
        r"CATEGORY BREAKDOWN\s*-+\s*(.*?)\s*(?:DIFFICULTY|=+)",
        content,
        re.DOTALL
    )

    if category_section:
        category_text = category_section.group(1)
        # Match lines like: "Basic Syntax          23.00/ 25 ( 92.0%) [5 tests]"
        category_matches = re.findall(
            r"([A-Za-z\s]+?)\s+(\d+\.?\d*)\/\s*(\d+)",
            category_text
        )

        for category_name, score, max_score in category_matches:
            category_name = category_name.strip()
            category_scores[category_name] = float(score)

    return total_score, category_scores


def get_average_score(directory: Path) -> Tuple[float, List[float], int, Dict[str, List[float]]]:
    """
    Finds all .txt files in a directory and calculates their average score.
    Returns: (average_score, list_of_scores, file_count, category_scores_by_category)
    """
    scores = []
    category_data = {}  # {category_name: [scores]}
    file_paths = glob.glob(str(directory / "*.txt"))

    if not file_paths:
        print(f"Warning: No .txt files found in directory: {directory}", file=sys.stderr)
        return 0.0, [], 0, {}

    for file_path in file_paths:
        total_score, category_scores = parse_score_from_report(Path(file_path))
        if total_score is not None:
            scores.append(total_score)

            # Collect category scores
            for category, score in category_scores.items():
                if category not in category_data:
                    category_data[category] = []
                category_data[category].append(score)

    if not scores:
        print(f"Warning: Could not parse any scores from files in: {directory}", file=sys.stderr)
        return 0.0, [], len(file_paths), {}

    return sum(scores) / len(scores), scores, len(file_paths), category_data


def compare_directories(dir1: Path, dir2: Path, dir1_label: str = "Directory 1", dir2_label: str = "Directory 2"):
    """
    Compares the average scores between two directories using Jinja template.
    """
    # Calculate average scores
    avg_score_1, scores_1, count_1, categories_1 = get_average_score(dir1)
    avg_score_2, scores_2, count_2, categories_2 = get_average_score(dir2)

    # Get all unique categories
    all_categories = set(categories_1.keys()) | set(categories_2.keys())

    # Calculate average scores per category
    category_averages_1 = {cat: sum(scores) / len(scores) for cat, scores in categories_1.items()}
    category_averages_2 = {cat: sum(scores) / len(scores) for cat, scores in categories_2.items()}

    # Setup Jinja environment
    template_dir = Path(__file__).parent / 'templates'
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template('comparison.md.jinja')

    # Render and print
    output = template.render(
        dir1=dir1,
        dir2=dir2,
        label1=dir1_label,
        label2=dir2_label,
        count1=count_1,
        count2=count_2,
        scores1=scores_1,
        scores2=scores_2,
        avg1=avg_score_1,
        avg2=avg_score_2,
        all_categories=all_categories,
        category_averages_1=category_averages_1,
        category_averages_2=category_averages_2
    )
    print(output)


def repair_json(json_str: str) -> str:
    """Attempt to repair common JSON syntax errors"""
    # Remove any leading/trailing whitespace
    json_str = json_str.strip()

    # Remove any markdown code block markers
    json_str = json_str.replace('```json', '').replace('```', '').strip()

    # Fix unterminated strings by checking for unbalanced quotes
    lines = json_str.split('\n')
    repaired_lines = []

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            repaired_lines.append(line)
            continue

        # Check if line has unterminated string (odd number of unescaped quotes after key)
        # Look for pattern: "key": "value... (no closing quote)
        if '":' in stripped and stripped.count('"') % 2 != 0:
            # Try to add closing quote
            if not stripped.endswith('"') and not stripped.endswith('",'):
                line = line.rstrip() + '"'
                stripped = line.strip()

        # Add comma if this line ends with a value and next line starts a new key or is closing brace
        if stripped.endswith('"') and not stripped.endswith('",') and not stripped.endswith('"}'):
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line.startswith('"') or next_line.startswith('}'):
                    line = line.rstrip() + ','

        repaired_lines.append(line)

    json_str = '\n'.join(repaired_lines)

    # Count opening and closing braces/brackets
    open_braces = json_str.count('{')
    close_braces = json_str.count('}')
    open_brackets = json_str.count('[')
    close_brackets = json_str.count(']')

    # Add missing closing braces
    if open_braces > close_braces:
        json_str += '\n' + '}' * (open_braces - close_braces)

    # Add missing closing brackets
    if open_brackets > close_brackets:
        json_str += '\n' + ']' * (open_brackets - close_brackets)

    # Remove trailing commas before closing braces/brackets
    json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)

    # Try to fix common escape sequence issues
    # If we have \n not inside a string value, it might be a newline issue
    # This is a heuristic and might not always work

    return json_str


class LLMBenchmarkRunner:
    """Automated LLM testing using LiteLLM API calls"""

    # Model name mappings for LiteLLM
    MODEL_MAPPING = {
        'claude-sonnet': 'claude-sonnet-4-5-20250929',
        'claude-opus': 'claude-opus-4-20250514',
        'claude-haiku': 'claude-3-5-haiku-20241022',
        'gemini-flash': 'gemini/gemini-2.0-flash-exp',
        'gemini-pro': 'gemini/gemini-2.5-pro-preview-03-25',
        'gpt-4': 'gpt-4o',
        'gpt-4-mini': 'gpt-4o-mini',
        'o1': 'o1',
        'o1-mini': 'o1-mini',
    }

    TESTS_DIR = Path('tests')
    RELEASE_DIR = Path('release')
    PROMPT_FILE = Path('prompt.md')
    TESTS_FILE = Path('tests.json')

    def __init__(self):
        if not LITELLM_AVAILABLE:
            raise RuntimeError("LiteLLM not available. Install with: pip install litellm")

        self.tests = self._load_tests()
        self.prompt_template = self._load_prompt_template()
        self.TESTS_DIR.mkdir(parents=True, exist_ok=True)

    def _load_tests(self) -> List[Dict]:
        """Load test cases from tests.json"""
        with open(self.TESTS_FILE, 'r') as f:
            return json.load(f)

    def _load_prompt_template(self) -> str:
        """Load prompt template from prompt.md"""
        with open(self.PROMPT_FILE, 'r') as f:
            return f.read()

    def _find_doc_file(self, variant: str) -> Path | None:
        """Find documentation file for given variant"""
        # Search all version directories
        doc_files = list(self.RELEASE_DIR.glob("**/*.txt"))

        # Try exact match first (e.g., mini_v3)
        for doc_file in doc_files:
            if variant.lower() in doc_file.stem.lower():
                return doc_file

        # Try partial match (e.g., mini matches mini_v3, mini_v2, mini)
        variant_base = variant.lower().replace('_v', '').replace('v', '')
        for doc_file in doc_files:
            if variant_base in doc_file.stem.lower():
                # Return the latest version (highest in lexicographic order)
                matching = [f for f in doc_files if variant_base in f.stem.lower()]
                return sorted(matching, reverse=True)[0]

        return None

    def _get_model_id(self, model_name: str) -> str:
        """Get LiteLLM model ID from friendly name"""
        # Check if it's a known alias
        if model_name in self.MODEL_MAPPING:
            return self.MODEL_MAPPING[model_name]
        # Otherwise use as-is (allows custom model names)
        return model_name

    def _display_api_key_status(self, model_id: str):
        """Display which API key is being used (with masking)"""
        def mask_key(key: str) -> str:
            if not key or len(key) < 12:
                return "***"
            return f"{key[:8]}...{key[-4:]}"

        # Determine which API key based on model
        if 'claude' in model_id.lower():
            key_name = 'ANTHROPIC_API_KEY'
        elif 'gemini' in model_id.lower():
            key_name = 'GEMINI_API_KEY'
        elif 'gpt' in model_id.lower() or 'o1' in model_id.lower():
            key_name = 'OPENAI_API_KEY'
        else:
            # Unknown provider, check all keys
            print(f"API Key Status:")
            for key_name in ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']:
                key_value = os.getenv(key_name)
                if key_value:
                    print(f"  {key_name}: {mask_key(key_value)}")
            return

        key_value = os.getenv(key_name)
        if key_value:
            print(f"API Key: {key_name} = {mask_key(key_value)}")
        else:
            print(f"WARNING: {key_name} not found in environment!")

    def _build_test_prompts_json(self, tests=None) -> str:
        """Build the test_prompts.json structure as a string"""
        tests_to_use = tests if tests is not None else self.tests
        prompts = {
            "instructions": self.prompt_template,
            "tests": [
                {
                    "id": test["id"],
                    "level": test["level"],
                    "category": test["category"],
                    "task": test["task"],
                    "points": test["points"],
                    "hints": test["hints"]
                }
                for test in tests_to_use
            ]
        }
        return json.dumps(prompts, indent=2)

    def _construct_prompt(self, doc_content: str, doc_name: str, tests_to_use=None) -> str:
        """Construct full prompt for LLM"""
        test_prompts_json = self._build_test_prompts_json(tests=tests_to_use)

        prompt = f"""You are a Jac programming language expert. You will be tested on your ability to write valid Jac code based on the provided documentation.

# Documentation
The following is the complete Jac language documentation you should reference:

{doc_content}

# Test Cases
{test_prompts_json}

# Your Task
Write valid Jac code for each test case. Return a single JSON object mapping test IDs to code strings.

**CRITICAL: JSON FORMAT REQUIREMENTS - VIOLATIONS WILL CAUSE COMPLETE FAILURE**

Your response MUST be ONLY valid, parseable JSON. No exceptions.

CORRECT FORMAT:
```json
{{
    "basic_01": "with entry {{\\n    print(\\"Hello, Jac!\\");\\n}}",
    "basic_02": "glob counter: int = 0;\\n\\nwith entry {{\\n    print(:g:counter);\\n}}"
}}
```

**MANDATORY REQUIREMENTS:**
1. Start with opening brace {{ - NOTHING before it
2. End with closing brace }} - NOTHING after it
3. Every string MUST have closing quotes - check EVERY line
4. NO trailing commas before closing braces
5. ALL {len(tests_to_use) if tests_to_use else len(self.tests)} tests MUST be included
6. Each key must be a test ID from the test cases above
7. Each value must be valid Jac code with proper JSON escaping (\\n, \\", \\\\)
8. Every opening brace, bracket, or quote MUST have a matching closing character

**COMMON ERRORS TO AVOID:**
- DO NOT write markdown code blocks (no ```json or ```)
- DO NOT add explanations or comments outside the JSON
- DO NOT forget closing quotes on strings
- DO NOT add trailing commas after the last entry
- DO NOT truncate the response - include ALL test IDs
- DO NOT leave strings unterminated

**VALIDATION CHECKLIST BEFORE SUBMITTING:**
✓ Count opening braces {{ - must equal closing braces }}
✓ Count opening brackets [ - must equal closing brackets ]
✓ Every quote " has a matching closing quote "
✓ No trailing commas before }} or ]
✓ Response contains exactly {len(tests_to_use) if tests_to_use else len(self.tests)} test IDs
✓ First character is {{
✓ Last character is }}

Your response will be parsed with json.loads(). If it fails to parse, all your work is wasted.

BEGIN RESPONSE WITH {{ NOW:
"""
        return prompt

    def _get_max_tokens_for_model(self, model_id: str) -> int:
        """Get appropriate max_tokens for a given model"""
        if 'haiku' in model_id.lower():
            return 8192
        elif 'claude' in model_id.lower():
            return 16000
        elif 'gemini' in model_id.lower():
            return 65536
        elif 'gpt-4o-mini' in model_id.lower():
            return 16000
        elif 'gpt-4o' in model_id.lower():
            return 16000
        elif 'o1' in model_id.lower():
            return 100000
        else:
            return 8192

    def run_benchmark(self, model_name: str, variant: str, temperature: float = None,
                     max_tokens: int = None, test_limit: int = None) -> Dict:
        """Run benchmark using LLM API"""
        if temperature is None:
            temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.1'))

        model_id = self._get_model_id(model_name)

        if max_tokens is None:
            max_tokens = self._get_max_tokens_for_model(model_id)

        # Find documentation file
        doc_file = self._find_doc_file(variant)
        if not doc_file:
            raise FileNotFoundError(
                f"No documentation file found for variant '{variant}'. "
                f"Available files: {[f.stem for f in self.RELEASE_DIR.glob('**/*.txt')]}"
            )

        print(f"Using documentation: {doc_file}")

        # Load documentation
        with open(doc_file, 'r') as f:
            doc_content = f.read()

        print(f"Using model: {model_id}")

        # Display API key status
        self._display_api_key_status(model_id)

        # Limit tests if specified (for small test suite mode)
        tests_to_use = self.tests[:test_limit] if test_limit else self.tests
        test_mode = f" (SMALL SUITE - first {test_limit} tests)" if test_limit else ""

        # Construct prompt
        prompt = self._construct_prompt(doc_content, doc_file.stem, tests_to_use=tests_to_use)

        print(f"\nCalling LLM API...{test_mode}")
        print(f"  Temperature: {temperature}")
        print(f"  Max tokens: {max_tokens}")
        print(f"  Documentation size: {len(doc_content)} chars")
        print(f"  Number of tests: {len(tests_to_use)}")

        # Retry logic for rate limits
        max_retries = 3
        retry_delay = 20  # Start with 20 seconds
        response_text = None

        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f"\nRetry attempt {attempt + 1}/{max_retries} after {retry_delay}s delay...")
                    time.sleep(retry_delay)

                # Make API call
                response = completion(
                    model=model_id,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens
                )

                # Extract response
                response_text = response.choices[0].message.content.strip()
                break  # Success, exit retry loop

            except Exception as e:
                error_msg = str(e)

                # Check if it's a rate limit error
                if 'RateLimitError' in str(type(e).__name__) or '429' in error_msg:
                    print(f"\nWARNING: Rate limit hit on attempt {attempt + 1}/{max_retries}")

                    # Extract retry time from error message if available
                    retry_match = re.search(r'retry in ([\d.]+)s', error_msg)
                    if retry_match:
                        suggested_delay = float(retry_match.group(1))
                        retry_delay = max(retry_delay, suggested_delay + 5)  # Add 5s buffer

                    if attempt < max_retries - 1:
                        print(f"   Will retry in {retry_delay} seconds...")
                        print(f"\n   TIP: Gemini free tier has strict rate limits:")
                        print(f"      - 15 requests/minute")
                        print(f"      - 1M tokens/minute")
                        print(f"      - 1,500 requests/day")
                        print(f"      Consider using Claude or GPT models, or upgrade to paid tier.")
                        retry_delay *= 2  # Exponential backoff
                    else:
                        print(f"\nERROR: Max retries reached. Rate limit persists.")
                        raise
                else:
                    # Non-rate-limit error, raise immediately
                    raise

        # Try to extract JSON if wrapped in markdown
        if '```json' in response_text:
            json_start = response_text.find('```json') + 7
            json_end = response_text.find('```', json_start)
            response_text = response_text[json_start:json_end].strip()
        elif '```' in response_text:
            json_start = response_text.find('```') + 3
            json_end = response_text.find('```', json_start)
            response_text = response_text[json_start:json_end].strip()

        # Parse JSON response
        try:
            responses = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"\nERROR: Failed to parse LLM response as JSON")
            print(f"Response preview (first 500 chars):")
            print(response_text[:500])
            print(f"\nJSON error: {e}")

            # Save raw response for debugging
            debug_file = self.TESTS_DIR / f"debug-{model_name}-{variant}.txt"
            with open(debug_file, 'w') as f:
                f.write(response_text)
            print(f"Full response saved to: {debug_file}")
            raise

        # Determine test suite type and generate timestamp
        test_suite_type = "small" if test_limit else "full"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Save responses to file with metadata (model name, suite type, timestamp)
        output_file = self.TESTS_DIR / f"{variant}-{model_name}-{test_suite_type}-{timestamp}.txt"

        # Create response object with metadata
        response_data = {
            "metadata": {
                "model": model_id,
                "model_alias": model_name,
                "variant": variant,
                "test_suite": test_suite_type,
                "total_tests": len(tests_to_use),
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            "responses": responses
        }

        with open(output_file, 'w') as f:
            json.dump(response_data, f, indent=2)

        print(f"\nResponses saved to: {output_file}")
        print(f"Generated code for {len(responses)} test cases ({test_suite_type} suite)")

        return {
            'model': model_id,
            'variant': variant,
            'doc_file': str(doc_file),
            'output_file': str(output_file),
            'num_responses': len(responses),
            'test_suite': test_suite_type,
            'responses': responses
        }

    def run_benchmark_concurrent(self, model_name: str, variant: str, temperature: float = None,
                                 max_tokens: int = None, test_limit: int = None,
                                 concurrency: int = 10, progress_callback=None) -> Dict:
        """Run benchmark using batched LLM API calls (45 tests per call)"""
        BATCH_SIZE = 45

        if temperature is None:
            temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.1'))

        model_id = self._get_model_id(model_name)

        if max_tokens is None:
            max_tokens = self._get_max_tokens_for_model(model_id)

        doc_file = self._find_doc_file(variant)
        if not doc_file:
            raise FileNotFoundError(
                f"No documentation file found for variant '{variant}'. "
                f"Available files: {[f.stem for f in self.RELEASE_DIR.glob('**/*.txt')]}"
            )

        print(f"Using documentation: {doc_file}")

        with open(doc_file, 'r') as f:
            doc_content = f.read()

        print(f"Using model: {model_id}")
        self._display_api_key_status(model_id)

        tests_to_use = self.tests[:test_limit] if test_limit else self.tests
        test_mode = f" (SMALL SUITE - first {test_limit} tests)" if test_limit else ""

        num_batches = (len(tests_to_use) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\nRunning batched benchmark...{test_mode}")
        print(f"  Temperature: {temperature}")
        print(f"  Max tokens: {max_tokens}")
        print(f"  Documentation size: {len(doc_content)} chars")
        print(f"  Number of tests: {len(tests_to_use)}")
        print(f"  Batch size: {BATCH_SIZE} tests per call")
        print(f"  Number of batches: {num_batches}")

        responses = {}

        for batch_num in range(num_batches):
            start_idx = batch_num * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, len(tests_to_use))
            batch = tests_to_use[start_idx:end_idx]

            print(f"\nProcessing batch {batch_num + 1}/{num_batches} ({len(batch)} tests)...")

            if progress_callback:
                progress_callback(start_idx, len(tests_to_use), f"Batch {batch_num + 1}/{num_batches}",
                                batch_num=batch_num + 1, num_batches=num_batches)

            batch_success = False
            max_retries = 2

            for retry in range(max_retries + 1):
                try:
                    if retry > 0:
                        import time
                        wait_time = 2 ** retry
                        print(f"  Retry {retry}/{max_retries} - making new LLM call after {wait_time}s delay...")
                        time.sleep(wait_time)

                    prompt = self._construct_prompt(doc_content, doc_file.stem, tests_to_use=batch)

                    response = completion(
                        model=model_id,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temperature,
                        max_tokens=max_tokens
                    )

                    response_text = response.choices[0].message.content.strip()

                    if '```json' in response_text:
                        json_start = response_text.find('```json') + 7
                        json_end = response_text.find('```', json_start)
                        response_text = response_text[json_start:json_end].strip()
                    elif '```' in response_text:
                        json_start = response_text.find('```') + 3
                        json_end = response_text.find('```', json_start)
                        response_text = response_text[json_start:json_end].strip()

                    # Try to parse JSON
                    try:
                        batch_responses = json.loads(response_text)
                        responses.update(batch_responses)
                        print(f"  Successfully parsed {len(batch_responses)} responses from batch {batch_num + 1}")
                        batch_success = True
                        break
                    except json.JSONDecodeError as e:
                        print(f"  JSON parse error: {e}")
                        print(f"  Attempting to repair JSON...")

                        # Try to repair the JSON
                        try:
                            repaired_json = repair_json(response_text)
                            batch_responses = json.loads(repaired_json)
                            responses.update(batch_responses)
                            print(f"  Successfully repaired and parsed {len(batch_responses)} responses from batch {batch_num + 1}")
                            batch_success = True
                            break
                        except json.JSONDecodeError as repair_error:
                            if retry < max_retries:
                                print(f"  JSON repair failed: {repair_error}")
                                print(f"  Will retry with new LLM call...")
                            else:
                                print(f"  Warning: Failed to parse response for batch {batch_num + 1} after {max_retries + 1} attempts")
                                print(f"  Final error: {repair_error}")

                                # Save failed response for manual inspection
                                failed_dir = self.TESTS_DIR / 'failed_responses'
                                failed_dir.mkdir(exist_ok=True)
                                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                                failed_file = failed_dir / f"failed_batch_{batch_num + 1}_{variant}_{model_name}_{timestamp}.txt"

                                with open(failed_file, 'w') as f:
                                    f.write(f"# Failed Response - Batch {batch_num + 1}/{num_batches}\n")
                                    f.write(f"# Model: {model_id}\n")
                                    f.write(f"# Variant: {variant}\n")
                                    f.write(f"# Error: {repair_error}\n")
                                    f.write(f"# Tests in batch: {len(batch)}\n")
                                    f.write("#" + "="*70 + "\n\n")
                                    f.write(response_text)

                                print(f"  Failed response saved to: {failed_file}")

                except Exception as e:
                    if retry < max_retries:
                        print(f"  Error on attempt {retry + 1}/{max_retries + 1}: {e}")
                    else:
                        print(f"  Error processing batch {batch_num + 1} after {max_retries + 1} attempts: {e}")

        if progress_callback:
            progress_callback(len(tests_to_use), len(tests_to_use), "Completed")

        test_suite_type = "small" if test_limit else "full"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = self.TESTS_DIR / f"{variant}-{model_name}-{test_suite_type}-{timestamp}.txt"

        response_data = {
            "metadata": {
                "model": model_id,
                "model_alias": model_name,
                "variant": variant,
                "test_suite": test_suite_type,
                "total_tests": len(tests_to_use),
                "temperature": temperature,
                "max_tokens": max_tokens,
                "batch_size": BATCH_SIZE,
                "num_batches": num_batches
            },
            "responses": responses
        }

        with open(output_file, 'w') as f:
            json.dump(response_data, f, indent=2)

        print(f"\nResponses saved to: {output_file}")
        print(f"Generated code for {len(responses)} test cases ({test_suite_type} suite)")

        return {
            'model': model_id,
            'variant': variant,
            'doc_file': str(doc_file),
            'output_file': str(output_file),
            'num_responses': len(responses),
            'test_suite': test_suite_type,
            'responses': responses
        }

    def get_available_variants(self) -> List[str]:
        """Get list of available documentation variants"""
        doc_files = list(self.RELEASE_DIR.glob("**/*.txt"))
        variants = []
        for doc_file in doc_files:
            # Extract variant name from filename (e.g., llmdocs-jaseci-mini_v3.txt -> mini_v3)
            name = doc_file.stem
            if 'llmdocs-jaseci-' in name:
                variant = name.split('llmdocs-jaseci-')[-1]
                variants.append(variant)
        return sorted(set(variants))

    def list_models(self):
        """List available model aliases"""
        print("Available model aliases:")
        for alias, model_id in sorted(self.MODEL_MAPPING.items()):
            print(f"  {alias:<20} -> {model_id}")
        print("\nYou can also use any LiteLLM-compatible model ID directly.")


def stash_test_results():
    """Stash current test results into a timestamped directory"""
    tests_dir = Path('tests')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    stash_dir = tests_dir / timestamp

    # Create stash directory
    stash_dir.mkdir(parents=True, exist_ok=True)

    moved_files = []

    # Move all .txt files in tests directory (not in subdirectories)
    test_files = [f for f in tests_dir.glob('*.txt') if f.is_file()]
    for file_path in test_files:
        dest = stash_dir / file_path.name
        file_path.rename(dest)
        moved_files.append(file_path.name)

    # Move any JSON test files
    json_files = [f for f in tests_dir.glob('*.json') if f.is_file()]
    for file_path in json_files:
        dest = stash_dir / file_path.name
        file_path.rename(dest)
        moved_files.append(file_path.name)

    print(f"Test results stashed in: {stash_dir}")
    print(f"\nMoved {len(moved_files)} item(s):")
    for item in moved_files:
        print(f"  - {item}")

    if not moved_files:
        print("  (No test files found to stash)")


def clean_test_results():
    """Delete all test result files from tests directory"""
    tests_dir = Path('tests')

    deleted_files = []

    # Delete all .txt files in tests directory (not in subdirectories)
    test_files = [f for f in tests_dir.glob('*.txt') if f.is_file()]
    for file_path in test_files:
        file_path.unlink()
        deleted_files.append(file_path.name)

    # Delete any JSON test files
    json_files = [f for f in tests_dir.glob('*.json') if f.is_file()]
    for file_path in json_files:
        file_path.unlink()
        deleted_files.append(file_path.name)

    print(f"Deleted {len(deleted_files)} test file(s):")
    for item in deleted_files:
        print(f"  - {item}")

    if not deleted_files:
        print("No test files found to delete")


def main():
    """Main execution"""
    if len(sys.argv) < 2:
        print("Jac Language LLM Benchmark Suite")
        print()
        print("LLM Testing Commands:")
        print("  ./benchmark.py bench <model> <variant>      - Run LLM benchmark")
        print("  ./benchmark.py bench <model> --all          - Run model on all variants")
        print("  ./benchmark.py bench-all                    - Run all models on all variants")
        print("  ./benchmark.py list-models                  - List available model aliases")
        print("  ./benchmark.py list-variants                - List available doc variants")
        print()
        print("Evaluation Commands:")
        print("  ./benchmark.py eval <file>                  - Evaluate single test file")
        print("  ./benchmark.py eval-all                     - Evaluate all variant test files")
        print()
        print("Utility Commands:")
        print("  ./benchmark.py gen [file]                   - Generate test_prompts.json")
        print("  ./benchmark.py stats                        - Show benchmark statistics")
        print("  ./benchmark.py stash                        - Stash test results to timestamped dir")
        print("  ./benchmark.py clean                        - Delete all test result files")
        print("  ./benchmark.py compare <d1> <d2>            - Compare two result directories")
        print()
        print("Examples:")
        print("  ./benchmark.py bench claude-sonnet mini_v3")
        print("  ./benchmark.py bench gemini-flash core_v3")
        print("  ./benchmark.py bench gpt-4 --all")
        print("  ./benchmark.py bench-all")
        print("  ./benchmark.py eval tests/test-llmdocs-jaseci-core_v3.txt")
        print("  ./benchmark.py eval-all")
        return
    
    command = sys.argv[1]
    
    if command == "eval":
        if len(sys.argv) < 3:
            print("Error: Please specify a responses file")
            print("Usage: ./benchmark.py eval <file>")
            return
        
        responses_file = sys.argv[2]
        if not Path(responses_file).exists():
            print(f"Error: File not found: {responses_file}")
            return
        
        print(f"Running benchmark on {responses_file}...")
        print()
        benchmark = JacBenchmark()
        results = benchmark.run_benchmark(responses_file)
        print(f"Evaluation complete. Results: {results['summary']['overall_percentage']:.1f}%")
    
    elif command == "eval-all":
        evaluator = MultiDocEvaluator()
        evaluator.evaluate_all()
        print("Evaluation complete. Use the control panel to view detailed results.")
    
    elif command == "gen":
        output = sys.argv[2] if len(sys.argv) > 2 else "test_prompts.json"
        generate_test_prompts(output)
    
    elif command == "stats":
        show_stats()

    elif command == "stash":
        stash_test_results()

    elif command == "clean":
        clean_test_results()

    elif command == "compare":
        if len(sys.argv) < 4:
            print("Error: Please specify two directories to compare")
            print("Usage: ./benchmark.py compare <dir1> <dir2> [--label1 NAME] [--label2 NAME]")
            return

        dir1 = Path(sys.argv[2])
        dir2 = Path(sys.argv[3])

        # Check for optional labels
        label1 = "Directory 1"
        label2 = "Directory 2"

        for i in range(4, len(sys.argv)):
            if sys.argv[i] == "--label1" and i + 1 < len(sys.argv):
                label1 = sys.argv[i + 1]
            elif sys.argv[i] == "--label2" and i + 1 < len(sys.argv):
                label2 = sys.argv[i + 1]

        if not dir1.exists() or not dir1.is_dir():
            print(f"Error: {dir1} is not a valid directory", file=sys.stderr)
            return

        if not dir2.exists() or not dir2.is_dir():
            print(f"Error: {dir2} is not a valid directory", file=sys.stderr)
            return

        compare_directories(dir1, dir2, label1, label2)

    elif command == "bench":
        if not LITELLM_AVAILABLE:
            print("Error: LiteLLM not installed. Install with: pip install litellm")
            return

        if len(sys.argv) < 3:
            print("Error: Please specify model name")
            print("Usage: ./benchmark.py bench <model> <variant>")
            print("       ./benchmark.py bench <model> --all")
            print("\nRun './benchmark.py list-models' to see available models")
            print("Run './benchmark.py list-variants' to see available variants")
            return

        model_name = sys.argv[2]

        # Check if running on all variants
        if len(sys.argv) >= 4 and sys.argv[3] == "--all":
            runner = LLMBenchmarkRunner()
            variants = runner.get_available_variants()

            if not variants:
                print("Error: No documentation variants found")
                return

            print(f"Running {model_name} on all variants: {', '.join(variants)}")
            print()

            results = []
            for variant in variants:
                print(f"\n{'='*80}")
                print(f"Processing variant: {variant}")
                print(f"{'='*80}\n")

                try:
                    result = runner.run_benchmark(model_name, variant)
                    results.append(result)
                except Exception as e:
                    print(f"Error with variant {variant}: {e}")
                    continue

            print(f"\n{'='*80}")
            print(f"COMPLETED: {len(results)}/{len(variants)} variants")
            print(f"{'='*80}")

            # Automatically run evaluation
            print("\nRunning evaluation...")
            evaluator = MultiDocEvaluator()
            evaluator.evaluate_all()
            evaluator.generate_comparison_report()

        else:
            if len(sys.argv) < 4:
                print("Error: Please specify variant")
                print("Usage: ./benchmark.py bench <model> <variant>")
                print("\nRun './benchmark.py list-variants' to see available variants")
                return

            variant = sys.argv[3]

            # Optional parameters
            temperature = 0.1
            max_tokens = 16000

            for i in range(4, len(sys.argv)):
                if sys.argv[i] == "--temperature" and i + 1 < len(sys.argv):
                    temperature = float(sys.argv[i + 1])
                elif sys.argv[i] == "--max-tokens" and i + 1 < len(sys.argv):
                    max_tokens = int(sys.argv[i + 1])

            runner = LLMBenchmarkRunner()

            try:
                result = runner.run_benchmark(model_name, variant, temperature, max_tokens)

                # Automatically run evaluation
                print("\n" + "="*80)
                print("Running evaluation...")
                print("="*80 + "\n")

                benchmark = JacBenchmark()
                eval_results = benchmark.run_benchmark(result['output_file'])
                benchmark.generate_report(eval_results)

            except Exception as e:
                print(f"Error: {e}")
                return

    elif command == "bench-all":
        if not LITELLM_AVAILABLE:
            print("Error: LiteLLM not installed. Install with: pip install litellm")
            return

        runner = LLMBenchmarkRunner()
        variants = runner.get_available_variants()

        if not variants:
            print("Error: No documentation variants found")
            return

        # Default models to test
        default_models = ['claude-sonnet', 'gemini-flash', 'gpt-4']

        # Allow custom model list via arguments
        if len(sys.argv) >= 3:
            models = sys.argv[2:]
        else:
            models = default_models

        print(f"Running benchmark for models: {', '.join(models)}")
        print(f"On variants: {', '.join(variants)}")
        print()

        total = len(models) * len(variants)
        completed = 0

        for model in models:
            for variant in variants:
                completed += 1
                print(f"\n{'='*80}")
                print(f"[{completed}/{total}] Model: {model}, Variant: {variant}")
                print(f"{'='*80}\n")

                try:
                    result = runner.run_benchmark(model, variant)
                except Exception as e:
                    print(f"Error: {e}")
                    continue

        print(f"\n{'='*80}")
        print(f"COMPLETED: All benchmarks finished")
        print(f"{'='*80}")

        # Run evaluation
        print("\nRunning evaluation on all results...")
        evaluator = MultiDocEvaluator()
        evaluator.evaluate_all()
        evaluator.generate_comparison_report()

    elif command == "list-models":
        if not LITELLM_AVAILABLE:
            print("Error: LiteLLM not installed. Install with: pip install litellm")
            return

        runner = LLMBenchmarkRunner()
        runner.list_models()

    elif command == "list-variants":
        runner = LLMBenchmarkRunner()
        variants = runner.get_available_variants()

        print("Available documentation variants:")
        for variant in variants:
            print(f"  {variant}")

        if not variants:
            print("  (No variants found)")

    else:
        print(f"Unknown command: {command}")
        print("Run './benchmark.py' without arguments for usage information")


if __name__ == "__main__":
    main()

