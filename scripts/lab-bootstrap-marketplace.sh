#!/usr/bin/env bash
# Idempotent lab marketplace bootstrap (API must be runnable via medusa exec).
# Prefer Linux worktree when present.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/apps/backend/packages/api"
if [[ -d /home/amber/alkemart-backend/packages/api ]]; then
  API_DIR=/home/amber/alkemart-backend/packages/api
fi

cd "$API_DIR"
echo "Using API dir: $API_DIR"

echo "== Ghana categories =="
bunx medusa exec ./src/scripts/ensure-ghana-categories.ts || true

echo "== Lab seller + product + offer =="
bunx medusa exec ./src/scripts/ensure-lab-commerce.ts || \
  bunx medusa exec ./src/scripts/ensure-lab-seller.ts || true

if [[ -n "${MEILISEARCH_HOST:-}" ]]; then
  echo "== Meilisearch reindex =="
  bunx medusa exec ./src/scripts/reindex-search.ts || true
else
  echo "Skip reindex (MEILISEARCH_HOST unset)"
fi

echo "Done. Seller Hub: http://localhost:9000/seller"
echo "Admin: http://localhost:9000/dashboard"
echo "Smoke: API=http://localhost:9000 PK=\$PK ./scripts/smoke-onboarding-quality.sh"
