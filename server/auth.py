"""Token-based admin authentication from config.json."""

import json
from functools import wraps
from pathlib import Path
from typing import Optional

from flask import request, jsonify

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def _load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_admin_name(token: str) -> Optional[str]:
    """Look up admin name by bearer token. Returns None if not found."""
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


def require_admin(f):
    """Decorator requiring a valid admin bearer token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header required (Bearer <token>)"}), 401
        token = auth_header[7:]
        admin_name = get_admin_name(token)
        if not admin_name:
            return jsonify({"error": "Invalid admin token"}), 403
        request.admin_name = admin_name
        return f(*args, **kwargs)
    return decorated
