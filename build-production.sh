#!/bin/bash
set -e
cd /root/work/amanbagrecha.github.io

# Backup current production
BACKUP_DIR="docs-backup-$(date +%Y%m%d-%H%M%S)"
[ -d "docs" ] && cp -r docs/ "$BACKUP_DIR"

echo "Building production site..."
quarto render --profile production

# Keep last 3 backups
ls -dt docs-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

echo "✓ Production: https://amanbagrecha.com"
