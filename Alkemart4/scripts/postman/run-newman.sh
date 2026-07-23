#!/usr/bin/env bash
# Run Alkemart API smoke via Newman (Postman CLI).
# Usage:
#   bun run smoke:api
#   ./scripts/postman/run-newman.sh
# Env: API, PK (or VITE_MEDUSA_PUBLISHABLE_KEY), MEMBER_TOKEN, SELLER_ID, ADMIN_TOKEN
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COLL="$ROOT/scripts/postman/alkemart-api-smoke.postman_collection.json"
ENV_FILE="$ROOT/scripts/postman/alkemart-local.postman_environment.json"
EXAMPLE="$ROOT/scripts/postman/alkemart-local.postman_environment.json.example"

API="${API:-http://127.0.0.1:9000}"
API="${API%/}"
PK="${PK:-${VITE_MEDUSA_PUBLISHABLE_KEY:-}}"

# Load PK from storefront .env if still empty
if [[ -z "$PK" ]]; then
  for f in \
    "$ROOT/apps/storefront/.env" \
    /home/amber/alkemart-storefront/.env
  do
    if [[ -f "$f" ]]; then
      PK="$(grep -E '^VITE_MEDUSA_PUBLISHABLE_KEY=' "$f" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
      [[ -n "$PK" ]] && break
    fi
  done
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
fi

# Build env overrides for this run (does not write secrets into the example)
ARGS=(run "$COLL" -e "$ENV_FILE" --color on --disable-unicode)
ARGS+=(--env-var "baseUrl=$API")
[[ -n "$PK" ]] && ARGS+=(--env-var "publishableKey=$PK")
[[ -n "${MEMBER_TOKEN:-}" ]] && ARGS+=(--env-var "memberToken=$MEMBER_TOKEN")
[[ -n "${SELLER_ID:-}" ]] && ARGS+=(--env-var "sellerId=$SELLER_ID")
[[ -n "${ADMIN_TOKEN:-}" ]] && ARGS+=(--env-var "adminToken=$ADMIN_TOKEN")

echo "== Newman API smoke =="
echo "API=$API"
[[ -n "$PK" ]] && echo "PK=set" || echo "PK=missing (catalog may skip)"

npx --yes newman "${ARGS[@]}"
