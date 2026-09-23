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

# Newer wrangler refuses `dev` without a per-binding local Hyperdrive
# connection string. Default both bindings to the Supabase pooler URL
# (IPv4; direct db host is IPv6-unreachable here) unless already exported.
if [[ -z "${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:-}" || -z "${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_PRIMARY:-}" ]]; then
  POOLER_URL="$(grep -E '^DATABASE_URL_POOLER=' .local/supabase-alkemart.env 2>/dev/null | cut -d= -f2- || true)"
  if [[ -z "$POOLER_URL" ]]; then
    echo "Missing Hyperdrive emulation URL: export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE and ..._HYPERDRIVE_PRIMARY, or add DATABASE_URL_POOLER= to .local/supabase-alkemart.env" >&2
    exit 1
  fi
  export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:-$POOLER_URL}"
  export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_PRIMARY="${CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_PRIMARY:-$POOLER_URL}"
fi

# workerd's Hyperdrive emulation terminates connections whose URL carries a
# query string (?sslmode=require → ECONNRESET on first query, dev server
# exits). The pooler mandates TLS anyway; strip query params, keep TLS.
strip_query() {
  local url="$1"
  echo "${url%%\?*}"
}
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$(strip_query "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE")"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_PRIMARY="$(strip_query "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_PRIMARY")"

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
