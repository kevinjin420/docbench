# Jac Language LLM Benchmark Suite

A comprehensive benchmarking system for testing LLM performance on Jac language code generation using automated API calls.

## Features

- **Automated LLM Testing**: Use LiteLLM to test multiple models via API
- **Documentation Variants**: Test with different documentation sizes (mini, core, full, slim)
- **Multiple Models**: Support for Claude, Gemini, GPT-4, O1, and custom models
- **Comprehensive Evaluation**: Detailed scoring with syntax validation and element checking
- **Batch Testing**: Run all models on all variants automatically
- **Result Comparison**: Compare performance across different documentation versions

## Installation

### Quick Setup (Recommended)

Run the automated setup script:

```bash
./setup.sh
```

This will:
- Install all dependencies
- Create `.env` file from template
- Verify all imports work
- Show available models and variants

Then edit `.env` and add your API keys:
```bash
nano .env  # or use your preferred editor
```

> 📖 **Detailed guide**: See [DOTENV_SETUP.md](DOTENV_SETUP.md) for complete .env configuration instructions

### Manual Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Setup environment file
cp .env.example .env
# Edit .env with your API keys
```

### API Keys

**Option 1: Using .env file (Recommended)**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
   GEMINI_API_KEY=your-actual-gemini-key-here
   OPENAI_API_KEY=sk-your-actual-openai-key-here
   ```

3. (Optional) Set default parameters:
   ```bash
   DEFAULT_TEMPERATURE=0.1
   DEFAULT_MAX_TOKENS=16000
   ```

**Option 2: Using environment variables**

Set them in your shell:
```bash
export ANTHROPIC_API_KEY="your-key-here"
export GEMINI_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
```

**Note**: The `.env` file is gitignored and will not be committed to version control.

## Quick Start

### 0. Setup (First Time Only)

```bash
# Install dependencies
pip install -r requirements.txt

# Setup API keys
cp .env.example .env
# Edit .env with your actual API keys
```

### 1. List Available Options

```bash
# See available models
./benchmark.py list-models

# See available documentation variants
./benchmark.py list-variants
```

### 2. Run a Single Benchmark

```bash
# Test Claude Sonnet with mini_v3 documentation
./benchmark.py bench claude-sonnet mini_v3

# Test Gemini Flash with core_v3 documentation
./benchmark.py bench gemini-flash core_v3
```

This will:
1. Load the specified documentation
2. Call the LLM API with all test cases
3. Save responses to `tests/test-llmdocs-jaseci-{variant}.txt`
4. Automatically evaluate and display results

### 3. Run Model on All Variants

```bash
# Test one model on all documentation variants
./benchmark.py bench claude-sonnet --all
```

### 4. Run All Models

```bash
# Test default models (claude-sonnet, gemini-flash, gpt-4) on all variants
./benchmark.py bench-all

# Or specify custom models
./benchmark.py bench-all claude-sonnet gemini-pro gpt-4-mini
```

## Command Reference

### LLM Testing Commands

| Command | Description |
|---------|-------------|
| `bench <model> <variant>` | Run single model on single variant |
| `bench <model> --all` | Run single model on all variants |
| `bench-all [models...]` | Run all/specified models on all variants |
| `list-models` | Show available model aliases |
| `list-variants` | Show available documentation variants |

### Evaluation Commands

| Command | Description |
|---------|-------------|
| `eval <file>` | Evaluate a single test result file |
| `eval-all` | Evaluate all variant test files and compare |

### Utility Commands

| Command | Description |
|---------|-------------|
| `gen [file]` | Generate test_prompts.json |
| `stats` | Show benchmark statistics |
| `stash` | Move test results to timestamped archive |
| `clean` | Delete all test result files |
| `compare <d1> <d2>` | Compare two result directories |

## Advanced Usage

### Custom Parameters

```bash
# Adjust temperature and max tokens
./benchmark.py bench claude-sonnet mini_v3 --temperature 0.2 --max-tokens 20000
```

### Using Custom Models

You can use any LiteLLM-compatible model ID:

```bash
# Use a specific model version
./benchmark.py bench claude-3-5-sonnet-20241022 mini_v3

# Use a custom endpoint
./benchmark.py bench azure/gpt-4 core_v3
```

## Available Models

| Alias | LiteLLM Model ID |
|-------|------------------|
| `claude-sonnet` | claude-sonnet-4-5-20250929 |
| `claude-opus` | claude-opus-4-20250514 |
| `claude-haiku` | claude-3-5-haiku-20241022 |
| `gemini-flash` | gemini/gemini-2.0-flash-exp |
| `gemini-pro` | gemini/gemini-2.0-pro-exp |
| `gpt-4` | gpt-4o |
| `gpt-4-mini` | gpt-4o-mini |
| `o1` | o1 |
| `o1-mini` | o1-mini |

## Documentation Variants

| Variant | Description | Size |
|---------|-------------|------|
| `mini_v3` | Minimal documentation v3 | ~10KB |
| `mini_v2` | Minimal documentation v2 | ~10KB |
| `mini` | Minimal documentation v1 | ~10KB |
| `core_v3` | Core documentation v3 | ~50KB |
| `core` | Core documentation v1 | ~50KB |
| `slim_v2` | Slim documentation v2 | ~30KB |
| `slim` | Slim documentation v1 | ~30KB |
| `full` | Full documentation | ~100KB |

## Test Structure

The benchmark includes 92 test cases across 10 difficulty levels:

- **Level 1**: Basic Syntax (10 tests, 5 points each)
- **Level 2**: Control Flow & Collections (11 tests, 10 points each)
- **Level 3**: Objects & Functions (10 tests, 15 points each)
- **Level 4**: Graph Basics (10 tests, 20 points each)
- **Level 5**: Walkers (10 tests, 25 points each)
- **Level 6**: Advanced Graph (10 tests, 30 points each)
- **Level 7**: AI Integration (10 tests, 35 points each)
- **Level 8**: Cloud Features (10 tests, 40 points each)
- **Level 9**: Imports & Advanced Features (6 tests, 45 points each)
- **Level 10**: Integration & Production Patterns (25 tests, 50-60 points each)

**Total**: 2,955 points possible

## Scoring System

Each test case is scored based on:

1. **Required Elements** (main score): Presence of mandatory syntax/keywords
2. **Forbidden Elements** (penalty): Presence of incorrect patterns (-30% max)
3. **Syntax Validation** (penalty): Common syntax errors (-10% per error, -50% max)

## Output Files

- `tests/test-llmdocs-jaseci-{variant}.txt` - Raw LLM responses (JSON)
- `tests/reports/evaluation_report_{timestamp}.md` - Detailed markdown reports
- `tests/{timestamp}/` - Archived test results

## Workflow

The typical benchmarking workflow:

1. **Generate**: Run LLM tests using `bench` commands
2. **Evaluate**: Automatic evaluation shows scores and feedback
3. **Compare**: Use `eval-all` to compare multiple variants
4. **Archive**: Use `stash` to save results before next run
5. **Analyze**: Review markdown reports in `tests/reports/`

## Examples

### Compare Documentation Versions

```bash
# Test mini_v3 vs core_v3
./benchmark.py bench claude-sonnet mini_v3
./benchmark.py bench claude-sonnet core_v3
./benchmark.py eval-all
```

### A/B Test Models

```bash
# Compare two models on same documentation
./benchmark.py bench claude-sonnet mini_v3
./benchmark.py stash  # Archive first result
./benchmark.py bench gemini-flash mini_v3
```

### Full Evaluation Suite

```bash
# Run comprehensive benchmark
./benchmark.py bench-all

# Results saved to tests/reports/
```

## Troubleshooting

### LiteLLM Not Available

```bash
pip install litellm
```

### API Key Issues

**Check if .env file exists and is configured:**
```bash
# Check if .env file exists
ls -la .env

# Verify keys are set (will show if env variables are loaded)
python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print('ANTHROPIC_API_KEY:', 'SET' if os.getenv('ANTHROPIC_API_KEY') else 'NOT SET')"
```

**If using shell environment variables, ensure they're set:**
```bash
echo $ANTHROPIC_API_KEY
echo $GEMINI_API_KEY
echo $OPENAI_API_KEY
```

**If keys aren't loading:**
1. Make sure you copied `.env.example` to `.env`
2. Check that keys are not wrapped in quotes in the `.env` file
3. Verify there are no extra spaces around the `=` sign

### JSON Parse Errors

If LLM returns invalid JSON, check `tests/debug-{model}-{variant}.txt` for the raw response.

### Rate Limiting

Add delays between tests in `bench-all`:
```python
# Edit benchmark.py, add after line 1558:
import time
time.sleep(5)  # 5 second delay
```

## Contributing

To add new test cases, edit `tests.json` with:
- `id`: Unique identifier
- `level`: Difficulty (1-10)
- `category`: Test category
- `task`: Description
- `required_elements`: Must-have patterns
- `forbidden_elements`: Disallowed patterns
- `points`: Score value
- `hints`: Guidance for LLM

## License

[Your License Here]

## Contact

[Your Contact Info]
