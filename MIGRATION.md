# Migration Guide: Agentic Testing → API-Based Automated Testing

This document outlines the migration from manual agentic LLM testing to automated API-based testing using LiteLLM.

## What Changed

### Before (Agentic Workflow)
1. Manually provide documentation, prompt.md, and tests.json to agentic LLMs
2. LLM manually creates output files
3. Run evaluation on generated files
4. Repeat process for each model/variant combination

### After (Automated API Workflow)
1. Run single command: `./benchmark.py bench <model> <variant>`
2. Script automatically:
   - Loads documentation from `release/` directory
   - Loads prompt from `prompt.md`
   - Loads tests from `tests.json`
   - Makes API call with structured prompt
   - Saves responses to `tests/` directory
   - Runs evaluation and displays results

## New Features

### 1. LLM API Integration
- **Class**: `LLMBenchmarkRunner` (added to `benchmark.py`)
- **Library**: LiteLLM for unified API access
- **Models**: Claude, Gemini, GPT-4, O1, and any LiteLLM-compatible model

### 2. New CLI Commands

#### `bench <model> <variant>`
Run a single model on a single documentation variant.

```bash
# Examples
./benchmark.py bench claude-sonnet mini_v3
./benchmark.py bench gemini-flash core_v3
./benchmark.py bench gpt-4 mini_v2
```

**What it does:**
1. Finds documentation file in `release/` matching variant
2. Constructs prompt combining doc + prompt.md + tests.json
3. Makes API call to specified model
4. Saves JSON response to `tests/test-llmdocs-jaseci-{variant}.txt`
5. Automatically runs evaluation and shows results

#### `bench <model> --all`
Run a single model on all available variants.

```bash
./benchmark.py bench claude-sonnet --all
```

**What it does:**
1. Discovers all variants in `release/` directory
2. Runs benchmark for each variant sequentially
3. Saves results for each variant
4. Runs `eval-all` to generate comparison report

#### `bench-all [models...]`
Run multiple models on all variants.

```bash
# Default models: claude-sonnet, gemini-flash, gpt-4
./benchmark.py bench-all

# Custom model list
./benchmark.py bench-all claude-sonnet gemini-pro gpt-4-mini
```

**What it does:**
1. Tests each model × variant combination
2. Shows progress: [N/M] Model: X, Variant: Y
3. Handles errors gracefully (continues on failure)
4. Generates comprehensive comparison report

#### `list-models`
Display available model aliases and their LiteLLM IDs.

```bash
./benchmark.py list-models
```

#### `list-variants`
Display available documentation variants.

```bash
./benchmark.py list-variants
```

### 3. Advanced Options

```bash
# Custom temperature
./benchmark.py bench claude-sonnet mini_v3 --temperature 0.2

# Custom max tokens
./benchmark.py bench claude-sonnet mini_v3 --max-tokens 20000

# Both
./benchmark.py bench claude-sonnet mini_v3 --temperature 0.2 --max-tokens 20000
```

## Code Changes

### Files Modified

#### `benchmark.py`
- **Added imports**: `litellm.completion`, `os`
- **Added class**: `LLMBenchmarkRunner` (~230 lines)
  - Model name mapping dictionary
  - Documentation file discovery
  - Prompt construction
  - API call handling
  - Response parsing and saving
- **Updated `main()`**: Added 4 new command handlers
- **Updated help**: New command documentation

### Files Created

#### `requirements.txt`
```txt
jinja2>=3.0.0
litellm>=1.0.0
```

#### `README.md`
Comprehensive documentation including:
- Installation instructions
- Quick start guide
- Command reference
- Model and variant listings
- Examples and troubleshooting

## Backward Compatibility

All existing commands remain unchanged:
- `eval <file>` - Still works the same
- `eval-all` - Still works the same
- `gen` - Still generates test_prompts.json
- `stats` - Still shows statistics
- `stash` - Still archives results
- `clean` - Still deletes test files
- `compare <d1> <d2>` - Still compares directories

The migration is **fully backward compatible** - existing workflows continue to function.

## Environment Setup

### Required API Keys

**Recommended: Use .env file**

```bash
# Copy example file
cp .env.example .env

# Edit .env and add your actual API keys
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# GEMINI_API_KEY=your-key-here
# OPENAI_API_KEY=sk-your-key-here
```

**Alternative: Environment variables**

```bash
# Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-..."

# Google Gemini
export GEMINI_API_KEY="..."

# OpenAI GPT
export OPENAI_API_KEY="sk-..."
```

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Verify installation
python3 -c "import litellm; print('LiteLLM installed successfully')"
python3 -c "from dotenv import load_dotenv; print('python-dotenv installed successfully')"
```

## Migration Path

### For Existing Users

1. **Install dependencies**:
   ```bash
   pip install litellm
   ```

2. **Set API keys**:
   ```bash
   export ANTHROPIC_API_KEY="your-key"
   export GEMINI_API_KEY="your-key"
   ```

3. **Try new workflow**:
   ```bash
   # List what's available
   ./benchmark.py list-models
   ./benchmark.py list-variants

   # Run a test
   ./benchmark.py bench claude-sonnet mini_v3
   ```

4. **Keep using old workflow if needed**:
   - Your manual test files still work with `eval` command
   - No changes required to existing workflows

### For New Users

Follow the Quick Start in README.md:
```bash
# Install dependencies
pip install -r requirements.txt

# Setup API keys
cp .env.example .env
# Edit .env with your actual API keys

# Run first test
./benchmark.py bench claude-sonnet mini_v3
```

## Model Mapping

The system provides friendly aliases that map to specific LiteLLM model IDs:

| Alias | LiteLLM Model ID | API Provider |
|-------|------------------|--------------|
| `claude-sonnet` | `claude-sonnet-4-5-20250929` | Anthropic |
| `claude-opus` | `claude-opus-4-20250514` | Anthropic |
| `claude-haiku` | `claude-3-5-haiku-20241022` | Anthropic |
| `gemini-flash` | `gemini/gemini-2.0-flash-exp` | Google |
| `gemini-pro` | `gemini/gemini-2.0-pro-exp` | Google |
| `gpt-4` | `gpt-4o` | OpenAI |
| `gpt-4-mini` | `gpt-4o-mini` | OpenAI |
| `o1` | `o1` | OpenAI |
| `o1-mini` | `o1-mini` | OpenAI |

You can also use any LiteLLM model ID directly as the model name.

## Variant Discovery

The system automatically discovers documentation variants from the `release/` directory structure:

```
release/
├── 0.1/
│   ├── llmdocs-jaseci-mini.txt      → variant: mini
│   ├── llmdocs-jaseci-core.txt      → variant: core
│   ├── llmdocs-jaseci-slim.txt      → variant: slim
│   └── llmdocs-jaseci-full.txt      → variant: full
├── 0.2/
│   ├── llmdocs-jaseci-mini_v2.txt   → variant: mini_v2
│   └── llmdocs-jaseci-slim_v2.txt   → variant: slim_v2
└── 0.3/
    ├── llmdocs-jaseci-mini_v3.txt   → variant: mini_v3
    └── llmdocs-jaseci-core_v3.txt   → variant: core_v3
```

## Prompt Construction

The automated system constructs prompts by combining:

1. **System Instructions**: Brief introduction
2. **Documentation**: Full content from variant file
3. **Test Cases**: Structured JSON from `tests.json` including:
   - Test ID, level, category
   - Task description
   - Points value
   - Hints
4. **Output Format**: Explicit JSON structure requirements
5. **Validation Rules**: Critical formatting requirements

This mirrors what you would manually provide to agentic LLMs, but fully automated.

## Error Handling

The system includes robust error handling:

- **JSON Parse Errors**: Saves raw response to `tests/debug-{model}-{variant}.txt`
- **API Failures**: Displays error message and continues (in batch mode)
- **Missing Files**: Clear error messages with available options
- **Missing API Keys**: LiteLLM provides helpful error messages

## Performance Considerations

- **Sequential Execution**: Models/variants run one at a time (prevents rate limiting)
- **Token Limits**: Default max_tokens=16000 (adjustable)
- **Temperature**: Default 0.1 for consistent results (adjustable)
- **Caching**: No caching (each run is fresh)

## Testing the Migration

Verify everything works:

```bash
# 1. Check installation
./benchmark.py list-models
./benchmark.py list-variants

# 2. Test single run
./benchmark.py bench claude-sonnet mini_v3

# 3. Check output
ls tests/test-llmdocs-jaseci-mini_v3.txt

# 4. Verify evaluation works
./benchmark.py eval tests/test-llmdocs-jaseci-mini_v3.txt

# 5. Test batch mode (optional, costs API credits)
./benchmark.py bench claude-sonnet --all
```

## Cost Considerations

API calls cost money. Estimates per full benchmark (92 tests):

- **Mini variant** (~10KB doc): ~$0.10-0.50 per model
- **Core variant** (~50KB doc): ~$0.50-2.00 per model
- **Full variant** (~100KB doc): ~$1.00-4.00 per model

Running `bench-all` with 3 models × 8 variants = 24 API calls.

## Troubleshooting

### "LiteLLM not available"
```bash
pip install litellm
```

### "API key not found"
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### JSON parsing fails
Check `tests/debug-{model}-{variant}.txt` for raw response. The LLM may have returned non-JSON output.

### Rate limiting
Add delays in `bench-all` or run models individually with pauses.

## Summary

✅ **Added**: Automated API-based testing via LiteLLM
✅ **Added**: 5 new CLI commands (bench, bench-all, list-models, list-variants, plus options)
✅ **Added**: Support for multiple models and providers
✅ **Added**: Automatic evaluation after generation
✅ **Added**: Comprehensive documentation (README.md)
✅ **Maintained**: Full backward compatibility with existing commands
✅ **Maintained**: Same output format and evaluation system

The migration successfully transforms the workflow from manual agentic testing to fully automated API-based testing while preserving all existing functionality.
