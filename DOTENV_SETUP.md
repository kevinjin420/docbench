# .env Setup Guide

This guide explains how to configure API keys using the `.env` file.

## Quick Setup

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit with your favorite editor
nano .env
# or
vim .env
# or
code .env
```

## .env File Format

The `.env` file should contain your API keys without quotes:

```bash
# ✓ Correct
ANTHROPIC_API_KEY=sk-ant-api03-abc123def456...
GEMINI_API_KEY=AIzaSyAbc123Def456...
OPENAI_API_KEY=sk-proj-abc123def456...

# ✗ Wrong - don't use quotes
ANTHROPIC_API_KEY="sk-ant-api03-abc123..."
ANTHROPIC_API_KEY='sk-ant-api03-abc123...'

# ✗ Wrong - no spaces around =
ANTHROPIC_API_KEY = sk-ant-api03-abc123...
```

## Getting API Keys

### Anthropic Claude
1. Visit: https://console.anthropic.com/
2. Sign up / Log in
3. Go to API Keys section
4. Create new key
5. Copy key starting with `sk-ant-`

### Google Gemini
1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the generated key

### OpenAI
1. Visit: https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click "Create new secret key"
4. Copy key starting with `sk-`

## Optional Configuration

You can also set default parameters in `.env`:

```bash
# Temperature (0.0 = deterministic, 1.0 = creative)
DEFAULT_TEMPERATURE=0.1

# Maximum tokens in response
DEFAULT_MAX_TOKENS=16000
```

These will be used when you don't specify `--temperature` or `--max-tokens` flags.

## Security Notes

1. **Never commit .env to git**
   - The `.env` file is in `.gitignore`
   - Always verify with: `git status`

2. **Keep keys private**
   - Don't share your `.env` file
   - Don't paste keys in public channels
   - Don't commit keys to repositories

3. **Rotate keys regularly**
   - Generate new keys periodically
   - Delete old keys from provider dashboard

4. **Use separate keys for development/production**
   - Different keys for different environments
   - Easy to revoke if compromised

## Verification

Check if your `.env` is working:

```bash
# Check if file exists
ls -la .env

# Test if keys load correctly
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()

keys = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']
for key in keys:
    status = '✓ SET' if os.getenv(key) else '✗ NOT SET'
    print(f'{key}: {status}')
"
```

## Troubleshooting

### Keys not loading

**Problem**: API calls fail with "API key not found"

**Solutions**:
1. Check file is named exactly `.env` (not `env` or `.env.txt`)
2. Verify file is in project root directory
3. Make sure there are no quotes around values
4. Check for extra spaces: `KEY=value` not `KEY = value`
5. Restart your terminal/shell

### Permission errors

**Problem**: Can't read `.env` file

**Solution**:
```bash
chmod 600 .env  # Make file readable only by you
```

### Wrong keys being used

**Problem**: Shell environment variables override `.env`

**Solution**:
```bash
# Check shell variables
echo $ANTHROPIC_API_KEY

# Unset if needed
unset ANTHROPIC_API_KEY
unset GEMINI_API_KEY
unset OPENAI_API_KEY
```

The benchmark script loads `.env` first, but shell environment variables take precedence.

## Environment Variable Priority

When the benchmark runs, keys are loaded in this order:

1. **Shell environment variables** (highest priority)
   ```bash
   export ANTHROPIC_API_KEY="shell-key"
   ```

2. **.env file** (medium priority)
   ```bash
   ANTHROPIC_API_KEY=dotenv-key
   ```

3. **Default values** (lowest priority)
   - Only used if neither of the above are set
   - Usually results in "API key not found" error

## Using Multiple Environments

If you need different configurations:

```bash
# Development
cp .env.example .env.dev
# Edit .env.dev with dev keys

# Production
cp .env.example .env.prod
# Edit .env.prod with prod keys

# Load specific env file
cp .env.dev .env    # Use dev keys
cp .env.prod .env   # Use prod keys
```

Or use shell environment:
```bash
# Development
export $(cat .env.dev | xargs)

# Production
export $(cat .env.prod | xargs)
```

## CI/CD Integration

For automated testing in CI/CD:

**GitHub Actions:**
```yaml
- name: Run benchmarks
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: ./benchmark.py bench claude-sonnet mini_v3
```

**GitLab CI:**
```yaml
test:
  script:
    - ./benchmark.py bench claude-sonnet mini_v3
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
    GEMINI_API_KEY: $GEMINI_API_KEY
```

Store secrets in your CI/CD platform's secret management system.

## Example Complete Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd jaseci-llmdocs

# 2. Run setup script
./setup.sh

# 3. Edit .env
nano .env
# Add:
# ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
# Save and exit (Ctrl+X, Y, Enter)

# 4. Verify
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print('ANTHROPIC_API_KEY:', 'SET' if os.getenv('ANTHROPIC_API_KEY') else 'NOT SET')"

# 5. Run first benchmark
./benchmark.py bench claude-sonnet mini_v3
```

## Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Verify with the verification command above
3. Check README.md for additional help
4. Ensure all dependencies are installed: `pip install -r requirements.txt`

## Summary

✓ Copy `.env.example` to `.env`
✓ Add your API keys without quotes
✓ No spaces around `=` sign
✓ File is in project root
✓ File is gitignored
✓ Keys are kept private

You're ready to run benchmarks! 🚀
