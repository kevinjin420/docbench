FROM oven/bun:1 AS frontend
WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ .
RUN bun run build

FROM python:3.13-slim
WORKDIR /app

RUN useradd -m -u 1000 -s /bin/bash appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser pipeline/ ./pipeline/
COPY --chown=appuser:appuser server/ ./server/
COPY --chown=appuser:appuser suites/ ./suites/
COPY --chown=appuser:appuser config.json .
COPY --from=frontend --chown=appuser:appuser /app/web/dist ./web/dist

USER appuser
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')" || exit 1

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "5000"]
