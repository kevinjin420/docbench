"""Public API routes."""

import os

from flask import Blueprint, request, jsonify

from pipeline import run_benchmark
from pipeline.validate import list_suites, load_suite

public = Blueprint("public", __name__)


ALLOWED_DOC_EXTENSIONS = {".txt", ".md"}
MAX_DOC_SIZE = 5 * 1024 * 1024  # 5 MB


@public.route("/api/run", methods=["POST"])
def api_run():
    """Run a benchmark. Accepts JSON body or multipart form with doc file."""
    if request.content_type and "multipart/form-data" in request.content_type:
        api_key = request.form.get("api_key")
        model = request.form.get("model")
        suite_name = request.form.get("suite", "standard")
        doc_url = request.form.get("doc_url")
        max_tokens = int(request.form.get("max_tokens", 16000))
        batch_size = int(request.form.get("batch_size", 45))
        temperature = float(request.form.get("temperature", 0.1))

        doc_content = None
        doc_file = request.files.get("doc_file")
        if doc_file and doc_file.filename:
            ext = os.path.splitext(doc_file.filename)[1].lower()
            if ext not in ALLOWED_DOC_EXTENSIONS:
                return jsonify({"error": f"Unsupported file type: {ext}. Allowed: .txt, .md"}), 400
            raw = doc_file.read(MAX_DOC_SIZE + 1)
            if len(raw) > MAX_DOC_SIZE:
                return jsonify({"error": "File too large (max 5 MB)"}), 400
            doc_content = raw.decode("utf-8", errors="replace")
    else:
        data = request.json or {}
        api_key = data.get("api_key")
        model = data.get("model")
        suite_name = data.get("suite", "standard")
        doc_url = data.get("doc_url")
        doc_content = data.get("doc_content")
        max_tokens = data.get("max_tokens", 16000)
        batch_size = data.get("batch_size", 45)
        temperature = data.get("temperature", 0.1)

    if not api_key:
        return jsonify({"error": "api_key is required"}), 400
    if not model:
        return jsonify({"error": "model is required"}), 400

    try:
        results = run_benchmark(
            api_key=api_key,
            model=model,
            suite_name=suite_name,
            doc_url=doc_url,
            doc_content=doc_content,
            max_tokens=max_tokens,
            batch_size=batch_size,
            temperature=temperature,
        )
        return jsonify(results)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": f"Internal error: {e}"}), 500


@public.route("/api/suites", methods=["GET"])
def api_list_suites():
    """List available test suites."""
    return jsonify(list_suites())


@public.route("/api/suites/<name>", methods=["GET"])
def api_get_suite(name: str):
    """Get test definitions for a suite."""
    try:
        suite = load_suite(name)
        return jsonify({
            "name": name,
            "total_tests": len(suite),
            "total_points": sum(t.get("points", 0) for t in suite),
            "tests": suite,
        })
    except FileNotFoundError:
        return jsonify({"error": f"Suite '{name}' not found"}), 404


@public.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})
