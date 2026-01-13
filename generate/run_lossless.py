#!/usr/bin/env python3
"""Run the lossless two-stage documentation pipeline."""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from pipeline.assembler import run_pipeline

if __name__ == "__main__":
    config = sys.argv[1] if len(sys.argv) > 1 else None
    result = run_pipeline(config)
    print(f"\nResult: {result}")
