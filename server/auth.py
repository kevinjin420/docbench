"""Token-based admin authentication from config.json."""

import json
from pathlib import Path
from typing import Optional

from starlette.requests import Request
from starlette.responses import JSONResponse

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def _load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_admin_name(token: str) -> Optional[str]:
    config = _load_config()
    for name, stored_token in config.get("admin_tokens", {}).items():
        if stored_token == token:
            return name
    return None


def get_defaults() -> dict:
    config = _load_config()
    return config.get("defaults", {
        "max_tokens": 16000,
        "batch_size": 45,
        "temperature": 0.1,
    })


def check_admin(request: Request) -> tuple[Optional[str], Optional[JSONResponse]]:
    """Validate admin token. Returns (admin_name, None) or (None, error_response)."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, JSONResponse(
            {"error": "Authorization header required (Bearer <token>)"}, status_code=401
        )
    token = auth_header[7:]
    admin_name = get_admin_name(token)
    if not admin_name:
        return None, JSONResponse({"error": "Invalid admin token"}, status_code=403)
    return admin_name, None
