#!/usr/bin/env bash
# Fix bun install cross-filesystem issue on systems where /tmp (tmpfs)
# is on a different filesystem than the project directory (btrfs).
#
# Add this to your ~/.bashrc or ~/.zshrc:
#   source /home/amber/Desktop/amber/Alkemart4/Alkemart4/scripts/fix-bun-tmpdir.sh
#
# Or run it once to set TMPDIR for the current session:
#   source scripts/fix-bun-tmpdir.sh

export TMPDIR="${HOME}/.tmp-bun"
mkdir -p "$TMPDIR"
echo "[fix-bun-tmpdir] TMPDIR=$TMPDIR (fixes bun install cross-filesystem rename)"
