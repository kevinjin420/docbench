#!/bin/bash

echo "=========================================="
echo "Starting Jac Benchmark Control Panel"
echo "=========================================="
echo ""

# Check if Python dependencies are installed
echo "Checking Python dependencies..."
MISSING_DEPS=""

if ! python3 -c "import flask" 2>/dev/null; then
    MISSING_DEPS="$MISSING_DEPS flask"
fi

if ! python3 -c "import flask_cors" 2>/dev/null; then
    MISSING_DEPS="$MISSING_DEPS flask-cors"
fi

if ! python3 -c "import flask_socketio" 2>/dev/null; then
    MISSING_DEPS="$MISSING_DEPS flask-socketio"
fi

if ! python3 -c "import socketio" 2>/dev/null; then
    MISSING_DEPS="$MISSING_DEPS python-socketio"
fi

if [ ! -z "$MISSING_DEPS" ]; then
    echo "Error: Missing Python dependencies:$MISSING_DEPS"
    echo "Run: pip install -r requirements.txt"
    exit 1
fi

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: Bun not installed"
    echo "Install from: https://bun.sh"
    exit 1
fi

# Check if frontend dependencies are installed
if [ ! -d "control-panel/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd control-panel && bun install && cd ..
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting Flask backend..."
python3 api.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting React frontend..."
cd control-panel
bun dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "Control Panel Running!"
echo "=========================================="
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo "=========================================="

# Wait for processes
wait
