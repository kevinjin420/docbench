#!/bin/bash

trap 'kill 0' EXIT

if command -v bun &> /dev/null; then
  PKG_MGR="bun"
  INSTALL_CMD="bun install"
  DEV_CMD="bun dev"
else
  PKG_MGR="npm"
  INSTALL_CMD="npm install"
  DEV_CMD="npm run dev"
fi

if [ ! -d "control-panel/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd control-panel && $INSTALL_CMD)
fi

python3 api.py "$@" &
(cd control-panel && $DEV_CMD) &

echo "Backend: http://localhost:5050"
echo "Frontend: http://localhost:5555 ($PKG_MGR)"

wait