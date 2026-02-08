#!/bin/bash
set -e

if command -v conda &> /dev/null; then
    eval "$(conda shell.bash hook)"
    conda activate jac 2>/dev/null || true
fi

jac start main.jac --port 5555 --api_port 5000 --dev
