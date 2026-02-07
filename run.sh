#!/bin/bash
set -e

if command -v conda &> /dev/null; then
    eval "$(conda shell.bash hook)"
    conda activate jac 2>/dev/null || true
fi

echo "Starting Jaseci DocBench..."
jac start main.jac
