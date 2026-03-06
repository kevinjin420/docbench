#!/usr/bin/env bash
set -e

trap 'kill 0' EXIT

cd "$(dirname "$0")"

uvicorn server.app:app --host 0.0.0.0 --port 5000 --reload &
cd web && bun run dev &

wait
