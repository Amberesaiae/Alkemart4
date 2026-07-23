#!/usr/bin/env bash
# Apply P1.3 marketplace indexes (idempotent) to Neon medusa-prod.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/scripts/ensure-p13-marketplace-indexes.sql"
PROJECT_ID="${NEON_PROJECT_ID:-wispy-union-10280789}"
BRANCH="${NEON_BRANCH:-medusa-prod}"
DB="${NEON_DATABASE:-alkemart_marketplace}"

if [[ ! -f "$SQL" ]]; then
  echo "Missing $SQL" >&2
  exit 1
fi

echo "Applying $SQL → project=$PROJECT_ID branch=$BRANCH db=$DB"
neonctl psql "$BRANCH" \
  --project-id "$PROJECT_ID" \
  --database-name "$DB" \
  < "$SQL"

echo "Done (P1.3 ensure)."
