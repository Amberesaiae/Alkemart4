#!/usr/bin/env bash
# Build + deploy all three gold UIs to Cloudflare Pages.
# Works around Node undici IPv6 ENETUNREACH to api.cloudflare.com on some networks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
  echo "Release blocked: working tree is not clean. Review and commit the release before deploying." >&2
  exit 1
fi
PRELOAD="$ROOT/scripts/node-ipv4-fetch-preload.cjs"
export NODE_OPTIONS="--dns-result-order=ipv4first -r ${PRELOAD}${NODE_OPTIONS:+ $NODE_OPTIONS}"
export VITE_ALKEMART_API_URL="${VITE_ALKEMART_API_URL:-https://api.alkemart.com}"
export VITE_ALKEMART_STOREFRONT_URL="${VITE_ALKEMART_STOREFRONT_URL:-https://alkemart.com}"
export VITE_STOREFRONT_URL="${VITE_STOREFRONT_URL:-$VITE_ALKEMART_STOREFRONT_URL}"
export VITE_VENDOR_APP_URL="${VITE_VENDOR_APP_URL:-https://sell.alkemart.com}"
export VITE_PUBLIC_SITE_URL="${VITE_PUBLIC_SITE_URL:-$VITE_STOREFRONT_URL}"
# Public Turnstile site key ("alkemart production sign-up" widget: alkemart.com,
# sell.alkemart.com). Its secret lives only in the Worker as TURNSTILE_SECRET_KEY.
export VITE_TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-0x4AAAAAAFFxBFw6fPs_cRjN}"

deploy_one() {
  local dir="$1" project="$2"
  echo "===== BUILD $project ====="
  (cd "$ROOT/$dir" && bun run build)
  echo "===== DEPLOY $project ====="
  # Name the production branch explicitly: wrangler otherwise infers it from
  # git, and a detached or feature checkout silently lands on a preview URL.
  (cd "$ROOT/$dir" && wrangler pages deploy dist --project-name "$project" --branch "${PAGES_BRANCH:-main}")
}

# The v2 apps are the live UIs (pilot build). The old apps (apps/storefront,
# apps/backend/apps/*) are retired — never deploy them again.
deploy_one apps/storefront-v2 alkemart4-storefront
deploy_one apps/vendor-v2 alkemart4-vendor
deploy_one apps/admin-v2 alkemart4-admin

echo "Done. Production aliases:"
echo "  https://alkemart.com"
echo "  https://sell.alkemart.com"
echo "  https://console.alkemart.com"
