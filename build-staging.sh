#!/bin/bash
set -e
cd /root/work/amanbagrecha.github.io
echo "Building staging site..."
quarto render --profile staging
echo "✓ Staging: https://staging.amanbagrecha.com"
