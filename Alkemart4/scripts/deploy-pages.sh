#!/usr/bin/env bash
# Build + deploy all three gold UIs to Cloudflare Pages.
# Works around Node undici IPv6 ENETUNREACH to api.cloudflare.com on some networks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRELOAD="$ROOT/scripts/node-ipv4-fetch-preload.cjs"
export NODE_OPTIONS="--dns-result-order=ipv4first -r ${PRELOAD}${NODE_OPTIONS:+ $NODE_OPTIONS}"
export VITE_ALKEMART_API_URL="${VITE_ALKEMART_API_URL:-https://alkemart-api.glean-circular-passport.workers.dev}"

deploy_one() {
  local dir="$1" project="$2"
  echo "===== BUILD $project ====="
  (cd "$ROOT/$dir" && bun run build)
  echo "===== DEPLOY $project ====="
  (cd "$ROOT/$dir" && wrangler pages deploy dist --project-name "$project" --commit-dirty=true)
}

deploy_one apps/storefront alkemart4-storefront
deploy_one apps/backend/apps/ghana-vendor alkemart4-vendor
deploy_one apps/backend/apps/admin alkemart4-admin

echo "Done. Production aliases:"
echo "  https://alkemart4-storefront.pages.dev"
echo "  https://alkemart4-vendor.pages.dev"
echo "  https://alkemart4-admin.pages.dev"
