"""Admin API routes for managing test suites."""

import json
from pathlib import Path

from flask import Blueprint, request, jsonify

from pipeline.validate import load_suite, validate_suite, list_suites, SUITES_DIR
from .auth import require_admin

admin = Blueprint("admin", __name__)


@admin.route("/api/admin/suites", methods=["GET"])
@require_admin
def admin_list_suites():
    """List all suites with metadata."""
    result = []
    for name in list_suites():
        suite = load_suite(name)
        result.append({
            "name": name,
            "total_tests": len(suite),
            "total_points": sum(t.get("points", 0) for t in suite),
        })
    return jsonify(result)


@admin.route("/api/admin/suites/<name>", methods=["POST"])
@require_admin
def admin_create_suite(name: str):
    """Create or overwrite a test suite."""
    data = request.json
    if not data or not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array of test definitions"}), 400

    SUITES_DIR.mkdir(parents=True, exist_ok=True)
    path = SUITES_DIR / f"{name}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    return jsonify({"status": "created", "name": name, "total_tests": len(data)})


@admin.route("/api/admin/suites/<name>", methods=["DELETE"])
@require_admin
def admin_delete_suite(name: str):
    """Delete a custom suite. Cannot delete 'standard'."""
    if name == "standard":
        return jsonify({"error": "Cannot delete the standard suite"}), 400

    path = SUITES_DIR / f"{name}.json"
    if not path.exists():
        return jsonify({"error": f"Suite '{name}' not found"}), 404

    path.unlink()
    return jsonify({"status": "deleted", "name": name})


@admin.route("/api/admin/suites/<name>/validate", methods=["POST"])
@require_admin
def admin_validate_suite(name: str):
    """Validate a suite against the current jac version."""
    try:
        suite = load_suite(name)
    except FileNotFoundError:
        return jsonify({"error": f"Suite '{name}' not found"}), 404

    result = validate_suite(suite)
    return jsonify(result)


@admin.route("/api/admin/suites/<name>/tests", methods=["PUT"])
@require_admin
def admin_update_tests(name: str):
    """Update specific tests in a suite (merge by test ID)."""
    updates = request.json
    if not updates or not isinstance(updates, list):
        return jsonify({"error": "Body must be a JSON array of test definitions"}), 400

    try:
        suite = load_suite(name)
    except FileNotFoundError:
        return jsonify({"error": f"Suite '{name}' not found"}), 404

    suite_by_id = {t["id"]: t for t in suite}
    added, updated = 0, 0
    for test in updates:
        tid = test.get("id")
        if not tid:
            continue
        if tid in suite_by_id:
            suite_by_id[tid] = test
            updated += 1
        else:
            suite_by_id[tid] = test
            added += 1

    new_suite = list(suite_by_id.values())
    path = SUITES_DIR / f"{name}.json"
    with open(path, "w") as f:
        json.dump(new_suite, f, indent=2)

    return jsonify({"status": "updated", "added": added, "updated": updated, "total": len(new_suite)})
