#!/usr/bin/env bash
# Run Workers API + three gold UIs for local development.
# Docs: docs/architecture/workers/LOCAL-DEV.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f apps/api/.dev.vars ]]; then
  echo "Missing apps/api/.dev.vars — copy from apps/api/.dev.vars.example and set JWT_SECRET" >&2
  exit 1
fi

export VITE_ALKEMART_API_URL="${VITE_ALKEMART_API_URL:-http://127.0.0.1:8787}"

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "API        → http://127.0.0.1:8787  (VITE_ALKEMART_API_URL=$VITE_ALKEMART_API_URL)"
echo "Storefront → http://127.0.0.1:5175"
echo "Vendor     → http://127.0.0.1:3002"
echo "Admin      → http://127.0.0.1:3001"

(cd apps/api && bun run dev) &
pids+=($!)

(cd apps/storefront && bun run dev) &
pids+=($!)

(cd apps/backend/apps/ghana-vendor && bun run dev) &
pids+=($!)

(cd apps/backend/apps/admin && bun run dev) &
pids+=($!)

wait
