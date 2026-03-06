"""Starlette application."""

import logging
import os
from pathlib import Path

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

from .routes import public_routes
from .admin import admin_routes

FRONTEND_DIR = Path(__file__).parent.parent / "web" / "dist"


def create_app() -> Starlette:
    routes = [*public_routes, *admin_routes]

    if FRONTEND_DIR.exists():
        routes.append(Mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets"))

        async def serve_frontend(request):
            path = request.path_params.get("path", "")
            file_path = FRONTEND_DIR / path
            if path and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(FRONTEND_DIR / "index.html")

        routes.append(Route("/{path:path}", serve_frontend))

    middleware = [
        Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]),
    ]

    return Starlette(routes=routes, middleware=middleware)


app = create_app()


def main():
    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s",
    )
    port = int(os.getenv("PORT", "5000"))
    logging.info(f"Starting docbench server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
