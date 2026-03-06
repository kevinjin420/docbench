"""Admin API routes for managing test suites."""

import json
from pathlib import Path

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from pipeline.validate import load_suite, validate_suite, list_suites, SUITES_DIR
from .auth import check_admin


async def admin_list_suites(request: Request):
    admin_name, error = check_admin(request)
    if error:
        return error
    result = []
    for name in list_suites():
        suite = load_suite(name)
        result.append({
            "name": name,
            "total_tests": len(suite),
            "total_points": sum(t.get("points", 0) for t in suite),
        })
    return JSONResponse(result)


async def admin_create_suite(request: Request):
    admin_name, error = check_admin(request)
    if error:
        return error
    name = request.path_params["name"]
    data = await request.json()
    if not data or not isinstance(data, list):
        return JSONResponse(
            {"error": "Body must be a JSON array of test definitions"}, status_code=400
        )
    SUITES_DIR.mkdir(parents=True, exist_ok=True)
    path = SUITES_DIR / f"{name}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return JSONResponse({"status": "created", "name": name, "total_tests": len(data)})


async def admin_delete_suite(request: Request):
    admin_name, error = check_admin(request)
    if error:
        return error
    name = request.path_params["name"]
    if name == "standard":
        return JSONResponse({"error": "Cannot delete the standard suite"}, status_code=400)
    path = SUITES_DIR / f"{name}.json"
    if not path.exists():
        return JSONResponse({"error": f"Suite '{name}' not found"}, status_code=404)
    path.unlink()
    return JSONResponse({"status": "deleted", "name": name})


async def admin_validate_suite(request: Request):
    admin_name, error = check_admin(request)
    if error:
        return error
    name = request.path_params["name"]
    try:
        suite = load_suite(name)
    except FileNotFoundError:
        return JSONResponse({"error": f"Suite '{name}' not found"}, status_code=404)
    result = validate_suite(suite)
    return JSONResponse(result)


async def admin_update_tests(request: Request):
    admin_name, error = check_admin(request)
    if error:
        return error
    name = request.path_params["name"]
    updates = await request.json()
    if not updates or not isinstance(updates, list):
        return JSONResponse(
            {"error": "Body must be a JSON array of test definitions"}, status_code=400
        )
    try:
        suite = load_suite(name)
    except FileNotFoundError:
        return JSONResponse({"error": f"Suite '{name}' not found"}, status_code=404)

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
    return JSONResponse({"status": "updated", "added": added, "updated": updated, "total": len(new_suite)})


admin_routes = [
    Route("/api/admin/suites", admin_list_suites, methods=["GET"]),
    Route("/api/admin/suites/{name}", admin_create_suite, methods=["POST"]),
    Route("/api/admin/suites/{name}", admin_delete_suite, methods=["DELETE"]),
    Route("/api/admin/suites/{name}/validate", admin_validate_suite, methods=["POST"]),
    Route("/api/admin/suites/{name}/tests", admin_update_tests, methods=["PUT"]),
]
