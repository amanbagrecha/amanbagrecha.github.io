#!/bin/bash
set -e
cd /root/work/amanbagrecha.github.io



echo "Building production site..."
quarto render --profile production


echo "✓ Production: https://amanbagrecha.com"
