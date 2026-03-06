"""Public API routes."""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from pipeline.run import run_benchmark_streaming, fetch_docs
from pipeline.validate import list_suites, load_suite

logger = logging.getLogger(__name__)

ALLOWED_DOC_EXTENSIONS = {".txt", ".md"}
MAX_DOC_SIZE = 5 * 1024 * 1024


class SSEResponse:
    """Server-Sent Events response."""

    def __init__(self, generator: AsyncGenerator):
        self.generator = generator

    async def __call__(self, scope, receive, send):
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [
                [b"content-type", b"text/event-stream"],
                [b"cache-control", b"no-cache"],
                [b"connection", b"keep-alive"],
                [b"x-accel-buffering", b"no"],
            ],
        })
        try:
            async for event in self.generator:
                payload = f"data: {json.dumps(event)}\n\n"
                await send({
                    "type": "http.response.body",
                    "body": payload.encode(),
                    "more_body": True,
                })
        finally:
            await send({"type": "http.response.body", "body": b"", "more_body": False})


async def api_run(request: Request):
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        api_key = form.get("api_key")
        model = form.get("model")
        suite_name = form.get("suite", "standard")
        doc_url = form.get("doc_url")
        max_tokens = int(form.get("max_tokens", 16000))
        batch_size = int(form.get("batch_size", 45))
        temperature = float(form.get("temperature", 0.1))

        doc_content = None
        doc_file = form.get("doc_file")
        if doc_file and hasattr(doc_file, "filename") and doc_file.filename:
            ext = os.path.splitext(doc_file.filename)[1].lower()
            if ext not in ALLOWED_DOC_EXTENSIONS:
                return JSONResponse(
                    {"error": f"Unsupported file type: {ext}. Allowed: .txt, .md"},
                    status_code=400,
                )
            raw = await doc_file.read()
            if len(raw) > MAX_DOC_SIZE:
                return JSONResponse({"error": "File too large (max 5 MB)"}, status_code=400)
            doc_content = raw.decode("utf-8", errors="replace")
    else:
        data = await request.json()
        api_key = data.get("api_key")
        model = data.get("model")
        suite_name = data.get("suite", "standard")
        doc_url = data.get("doc_url")
        doc_content = data.get("doc_content")
        max_tokens = data.get("max_tokens", 16000)
        batch_size = data.get("batch_size", 45)
        temperature = data.get("temperature", 0.1)

    if not api_key:
        return JSONResponse({"error": "api_key is required"}, status_code=400)
    if not model:
        return JSONResponse({"error": "model is required"}, status_code=400)

    async def event_stream() -> AsyncGenerator:
        try:
            for event in run_benchmark_streaming(
                api_key=api_key,
                model=model,
                suite_name=suite_name,
                doc_url=doc_url,
                doc_content=doc_content,
                max_tokens=max_tokens,
                batch_size=batch_size,
                temperature=temperature,
            ):
                yield event
                await asyncio.sleep(0)
        except FileNotFoundError as exc:
            yield {"type": "error", "error": str(exc)}
        except ValueError as exc:
            yield {"type": "error", "error": str(exc)}
        except RuntimeError as exc:
            yield {"type": "error", "error": str(exc)}
        except Exception as exc:
            yield {"type": "error", "error": f"Internal error: {exc}"}

    return SSEResponse(event_stream())


async def api_list_suites(request: Request):
    return JSONResponse(list_suites())


async def api_get_suite(request: Request):
    name = request.path_params["name"]
    try:
        suite = load_suite(name)
        return JSONResponse({
            "name": name,
            "total_tests": len(suite),
            "total_points": sum(t.get("points", 0) for t in suite),
            "tests": suite,
        })
    except FileNotFoundError:
        return JSONResponse({"error": f"Suite '{name}' not found"}, status_code=404)


async def health(request: Request):
    return JSONResponse({"status": "ok"})


public_routes = [
    Route("/api/run", api_run, methods=["POST"]),
    Route("/api/suites", api_list_suites, methods=["GET"]),
    Route("/api/suites/{name}", api_get_suite, methods=["GET"]),
    Route("/api/health", health, methods=["GET"]),
]
