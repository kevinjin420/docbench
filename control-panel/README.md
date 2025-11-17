# Jac Benchmark Control Panel

Web-based control panel for running and managing LLM documentation benchmarks.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Flask (Python)
- **Runtime**: Bun
- **API**: REST

## Setup

### 1. Install Dependencies

Frontend (from control-panel directory):
```bash
cd control-panel
bun install
```

Backend (from root directory):
```bash
pip install flask flask-cors
```

### 2. Start the Backend

From the root directory:
```bash
python3 api.py
```

The API will be available at `http://localhost:5000`

### 3. Start the Frontend

From the control-panel directory:
```bash
bun dev
```

The UI will be available at `http://localhost:5173`

## Features

### Run Benchmarks
- Select model (Claude, Gemini, GPT)
- Choose documentation variant
- Adjust temperature and max tokens
- Monitor progress in real-time

### Evaluate Results
- View evaluation scores and breakdowns
- Compare multiple variants
- See category and difficulty level performance

### Manage Files
- List all test result files
- Stash results to timestamped directory
- Clean up test files

### System Status
- Check API key availability
- View benchmark statistics
- Monitor running tasks

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/models` - List available models
- `GET /api/variants` - List documentation variants
- `GET /api/stats` - Get benchmark statistics
- `GET /api/test-files` - List test result files
- `GET /api/env-status` - Check API key status
- `POST /api/benchmark/run` - Run benchmark
- `GET /api/benchmark/status/:id` - Get benchmark status
- `POST /api/evaluate` - Evaluate a test file
- `POST /api/evaluate-all` - Evaluate all variants
- `POST /api/stash` - Stash test results
- `POST /api/clean` - Clean test files

## Development

### Frontend
```bash
bun dev          # Start dev server
bun build        # Build for production
bun preview      # Preview production build
```

### Backend
```bash
python3 api.py   # Run Flask server in debug mode
```

## Architecture

```
control-panel/          React frontend
├── src/
│   ├── App.tsx        Main UI component
│   ├── App.css        Styling
│   └── main.tsx       Entry point
└── package.json       Dependencies

api.py                 Flask REST API
benchmark.py           Core benchmark logic
```

## Notes

- Ensure .env file is configured with API keys
- Backend must be running for frontend to work
- Results are saved to the `tests/` directory
- Reports are saved to `tests/reports/`
