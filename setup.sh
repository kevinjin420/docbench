#!/bin/bash
# Setup script for Jac LLM Benchmark Suite

set -e

echo "========================================"
echo "Jac LLM Benchmark Suite - Setup"
echo "========================================"
echo

# Check Python version
echo "Checking Python version..."
python3 --version || { echo "Error: Python 3 not found. Please install Python 3.8+"; exit 1; }
echo "✓ Python found"
echo

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt || { echo "Error: Failed to install dependencies"; exit 1; }
echo "✓ Dependencies installed"
echo

# Setup .env file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env file created"
    echo
    echo "⚠️  IMPORTANT: Edit .env and add your API keys before running benchmarks"
    echo "   nano .env  # or use your preferred editor"
else
    echo "✓ .env file already exists"
fi
echo

# Test imports
echo "Testing imports..."
python3 -c "import litellm; print('✓ LiteLLM import successful')" || { echo "✗ LiteLLM import failed"; exit 1; }
python3 -c "from dotenv import load_dotenv; print('✓ python-dotenv import successful')" || { echo "✗ python-dotenv import failed"; exit 1; }
python3 -c "import jinja2; print('✓ Jinja2 import successful')" || { echo "✗ Jinja2 import failed"; exit 1; }
echo

# List available options
echo "Available models:"
python3 benchmark.py list-models
echo

echo "Available documentation variants:"
python3 benchmark.py list-variants
echo

echo "========================================"
echo "Setup complete!"
echo "========================================"
echo
echo "Next steps:"
echo "  1. Edit .env and add your API keys:"
echo "     nano .env"
echo
echo "  2. Run your first benchmark:"
echo "     ./benchmark.py bench claude-sonnet mini_v3"
echo
echo "  3. For more help:"
echo "     ./benchmark.py"
echo
