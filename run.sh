#!/usr/bin/env bash
set -e

trap 'kill 0' EXIT

cd "$(dirname "$0")"

python3 -m server.app &
cd web && bun run dev &

wait
