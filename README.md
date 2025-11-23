# Jaseci LLM Docs Benchmark

A benchmarking tool for evaluating LLM performance on Jaseci documentation comprehension tasks.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database
- [OpenRouter API key](https://openrouter.ai/keys)

## Installation

### 1. Clone and setup Python environment

```bash
git clone <repo-url>
cd jaseci-llmdocs

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd control-panel
npm install  # or: bun install
cd ..
```

### 3. Setup PostgreSQL database

```bash
# Start PostgreSQL (using Docker)
docker run -d --name jaseci-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=jaseci_benchmark \
  -p 5432:5432 \
  postgres:15

# Or use an existing PostgreSQL instance
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/jaseci_benchmark`)

## Running

Start both backend and frontend (auto-detects bun/npm):

```bash
./run.sh
```

Or run separately:

```bash
# Terminal 1 - Backend
source venv/bin/activate
python3 api.py

# Terminal 2 - Frontend
cd control-panel
npm run dev  # or: bun dev
```

Access the control panel at http://localhost:5555

## Usage

1. Select a model and documentation variant from the control panel
2. Run benchmarks to evaluate LLM comprehension
3. View results, compare runs, and export graphs (SVG/PNG)
4. Stash results into collections for later analysis

## Project Structure

```
├── backend/          # Flask API server
│   ├── routes/       # API endpoints
│   └── services/     # Business logic
├── control-panel/    # React frontend
├── database/         # SQLAlchemy models
├── docs/             # Jaseci documentation
└── release/          # Pre-built documentation variants
```
