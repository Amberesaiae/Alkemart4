#!/usr/bin/env bash
set -euo pipefail

# Fix bun install cross-filesystem issue (tmpfs /tmp vs btrfs /home)
# Bun uses rename() for package linking which fails across filesystems.
# Setting TMPDIR to a btrfs-compatible location fixes this.
export TMPDIR="${HOME}/.tmp-bun"
mkdir -p "$TMPDIR"

echo "=== Alkemart Dev Setup ==="
echo "TMPDIR=$TMPDIR (fixes bun install cross-filesystem rename)"

# Install dependencies
echo ""
echo "Installing dependencies..."
bun install

# Create .env files from templates if they don't exist
echo ""
echo "Setting up .env files..."

echo ""
echo "=== Setup Complete ==="
echo "Run: bun run dev (from repo root)"
echo "Or:  bun run dev:backend + bun run dev:storefront (separate terminals)"
