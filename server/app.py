"""Minimal Flask application."""

import logging
import os
import sys
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS

from .routes import public
from .admin import admin

FRONTEND_DIR = Path(__file__).parent.parent / "web" / "dist"


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    app.register_blueprint(public)
    app.register_blueprint(admin)

    if FRONTEND_DIR.exists():
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path: str):
            file_path = FRONTEND_DIR / path
            if file_path.is_file():
                return send_from_directory(FRONTEND_DIR, path)
            return send_from_directory(FRONTEND_DIR, "index.html")

    return app


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s",
    )

    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    app = create_app()
    logging.info(f"Starting docbench server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    main()
