# Benchmark Control Panel - Quick Start Guide

A web-based UI for running and managing LLM documentation benchmarks.

## Quick Start

### Option 1: One Command Start (Recommended)

```bash
./start-control-panel.sh
```

This will:
- Start the Flask backend on port 5000
- Start the React frontend on port 5173
- Open both in your terminal

Access the control panel at: **http://localhost:5173**

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
python3 api.py
```

**Terminal 2 - Frontend:**
```bash
cd control-panel
bun dev
```

## Features

### 1. Run Benchmarks
- **Select Model**: Choose from Claude, Gemini, or GPT models
- **Choose Documentation**: Pick from available variants (mini, core, etc.)
- **Configure**: Set temperature and max tokens
- **Monitor**: Real-time status updates during execution

### 2. View Results
- **Scores**: See overall percentage and point breakdowns
- **Categories**: View performance by category (AI Integration, Graph Basics, etc.)
- **Difficulty Levels**: See how the model performs across different complexity levels

### 3. Manage Files
- **List Files**: See all test result files with sizes
- **Evaluate**: Run evaluation on specific test files
- **Stash**: Save results to timestamped archive
- **Clean**: Remove all test files

### 4. System Status
- **API Keys**: Check which keys are configured
- **Statistics**: View total tests and point distribution
- **Progress**: Monitor running benchmarks

## Usage Examples

### Running a Benchmark

1. Open http://localhost:5173
2. Select model (e.g., "claude-sonnet")
3. Select variant (e.g., "mini_v3")
4. Click "Run Benchmark"
5. Wait for completion (status will update automatically)
6. View results in the "Evaluation Results" section

### Comparing Documentation Variants

1. Run benchmarks for each variant you want to compare
2. Click "Evaluate All" button
3. View side-by-side comparison in the results panel

### Cleaning Up

1. Click "Stash Results" to archive current results
2. Click "Clean All" to remove test files
3. Confirm deletion

## API Key Setup

The control panel will show API key status at the top:
- **Green checkmark**: Key is configured
- **Red X**: Key is missing

To add missing keys, edit your `.env` file:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
GEMINI_API_KEY=your-gemini-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

Then restart the backend server.

## Troubleshooting

### Backend won't start
```bash
# Install dependencies
pip install flask flask-cors
```

### Frontend won't start
```bash
# Install dependencies
cd control-panel
bun install
```

### API connection errors
- Ensure backend is running on port 5000
- Check browser console for CORS errors
- Verify .env file is in the root directory

### Benchmark fails immediately
- Check API key is configured
- Verify documentation files exist in `release/` directory
- Check backend terminal for error messages

## Architecture

```
┌─────────────────────────────────┐
│   React Frontend (Port 5173)    │
│  - User Interface               │
│  - Real-time Status Updates     │
└────────────┬────────────────────┘
             │ REST API
             │ (HTTP)
┌────────────▼────────────────────┐
│   Flask Backend (Port 5000)     │
│  - API Endpoints                │
│  - Background Tasks             │
└────────────┬────────────────────┘
             │
             │ Python Import
             │
┌────────────▼────────────────────┐
│      benchmark.py               │
│  - Core Logic                   │
│  - LLM API Calls                │
│  - Evaluation System            │
└─────────────────────────────────┘
```

## Development

### Frontend Development
```bash
cd control-panel
bun dev          # Start dev server with hot reload
bun build        # Build for production
bun preview      # Preview production build
```

### Backend Development
```bash
python3 api.py   # Run with Flask debug mode
```

### Adding New Features

**Backend (api.py):**
1. Add new route handler
2. Import needed functions from benchmark.py
3. Return JSON response

**Frontend (App.tsx):**
1. Create state for new feature
2. Add API call function
3. Update UI components

## File Locations

- **Backend**: `/api.py`
- **Frontend**: `/control-panel/src/App.tsx`
- **Styles**: `/control-panel/src/App.css`
- **Test Results**: `/tests/test-*.txt`
- **Reports**: `/tests/reports/*.md`
- **Documentation**: `/release/**/*.txt`

## Performance Tips

1. **Use Mini Variants**: Start with smaller docs (mini_v3) for faster testing
2. **Adjust Tokens**: Reduce max_tokens if getting rate limited
3. **Stash Regularly**: Archive results before running new benchmarks
4. **Monitor Progress**: Watch backend terminal for detailed logs

## Next Steps

1. Run your first benchmark with Claude Sonnet on mini_v3
2. Evaluate the results
3. Compare with other models or variants
4. Archive your results with "Stash"

## Support

- Check backend terminal for detailed error messages
- View browser console for frontend issues
- Read API endpoint documentation in `control-panel/README.md`
- Review benchmark.py documentation for core logic
