"""Validate test suite definitions against the current jac version."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List

DEPRECATED_PATTERNS = {
    ":g:": "Removed in 0.8.4 -- use `global` keyword",
    ":global:": "Removed in 0.8.4 -- use `global` keyword",
    ":nonlocal:": "Removed in 0.8.4 -- use `nonlocal` keyword",
    "<>": "Removed in 0.10.0 -- use backtick escaping",
    "dotgen(": "Removed in 0.8.1 -- use printgraph()",
    "jac serve": "Removed in 0.9.5 -- use `jac start`",
    "import from byllm {": "Changed in 0.8.10 -- use `import from byllm.lib {`",
}

SUSPICIOUS_IN_REQUIRED = {
    "`root": "Deprecated in 0.10.0 -- use `Root` (capitalized)",
    "`?": "Deprecated in 0.10.0 -- use (?:Type) syntax",
}

SUITES_DIR = Path(__file__).parent.parent / "suites"


def load_suite(name: str) -> List[Dict]:
    path = SUITES_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Suite not found: {path}")
    with open(path) as f:
        return json.load(f)


def list_suites() -> List[str]:
    if not SUITES_DIR.exists():
        return []
    return [p.stem for p in sorted(SUITES_DIR.glob("*.json"))]


def _jac_check(code: str) -> tuple[bool, str]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jac", delete=False, dir="/tmp") as f:
        f.write(code)
        path = f.name
    try:
        result = subprocess.run(["jac", "check", path], capture_output=True, text=True, timeout=15)
        errors = [l.strip() for l in (result.stdout + result.stderr).split("\n")
                  if "Error" in l or "error" in l.lower()]
        return result.returncode == 0, "; ".join(errors[:3])
    except FileNotFoundError:
        return False, "jac command not found"
    except subprocess.TimeoutExpired:
        return False, "Timeout"
    finally:
        os.unlink(path)


def validate_suite(suite: List[Dict]) -> Dict:
    """Validate a test suite. Returns {"valid": bool, "issues": [...], "warnings": [...]}."""
    issues = []
    warnings = []
    required_fields = {"id", "level", "category", "task", "required_elements", "points"}

    ids_seen = set()
    for i, t in enumerate(suite):
        tid = t.get("id", f"index_{i}")

        missing = required_fields - set(t.keys())
        if missing:
            issues.append(f"{tid}: missing fields {missing}")

        if tid in ids_seen:
            issues.append(f"Duplicate test ID: {tid}")
        ids_seen.add(tid)

        if not isinstance(t.get("required_elements", []), list):
            issues.append(f"{tid}: required_elements must be a list")

        all_patterns = {**DEPRECATED_PATTERNS, **SUSPICIOUS_IN_REQUIRED}
        for elem in t.get("required_elements", []):
            for pattern, desc in all_patterns.items():
                if pattern in elem:
                    issues.append(f"{tid}: required_element '{elem}' -- {desc}")

        for field in ["task", "broken_code", "partial_code", "test_harness"]:
            val = t.get(field, "")
            if val:
                for pattern, desc in DEPRECATED_PATTERNS.items():
                    if pattern in val:
                        issues.append(f"{tid}: {field} contains '{pattern}' -- {desc}")

        if t.get("test_harness"):
            ok, err = _jac_check(t["test_harness"])
            if not ok:
                issues.append(f"{tid}: test_harness fails jac check -- {err}")

        if t.get("broken_code"):
            ok, _ = _jac_check(t["broken_code"])
            if ok:
                warnings.append(f"{tid}: broken_code compiles (bug may be behavioral)")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "total_tests": len(suite),
        "total_points": sum(t.get("points", 0) for t in suite),
    }


if __name__ == "__main__":
    suite_name = sys.argv[1] if len(sys.argv) > 1 else "standard"
    suite = load_suite(suite_name)
    print(f"Validating suite '{suite_name}': {len(suite)} tests")

    result = validate_suite(suite)
    print(f"Total points: {result['total_points']}")

    if result["warnings"]:
        print(f"\nWarnings ({len(result['warnings'])}):")
        for w in result["warnings"]:
            print(f"  - {w}")

    if result["issues"]:
        print(f"\nFAILED: {len(result['issues'])} issues")
        for issue in result["issues"]:
            print(f"  - {issue}")
        sys.exit(1)
    else:
        print("\nPASSED")
