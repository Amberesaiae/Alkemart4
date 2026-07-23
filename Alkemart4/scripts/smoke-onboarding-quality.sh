#!/usr/bin/env bash
# Smoke-check onboarding + quality + catalog surfaces against a running API.
# Usage:
#   API=http://localhost:9000 PK=pk_... ./scripts/smoke-onboarding-quality.sh
# Optional: MEMBER_TOKEN, SELLER_ID, ADMIN_TOKEN for authenticated checks.
set -euo pipefail

API="${API:-http://localhost:9000}"
API="${API%/}"
PK="${PK:-${VITE_MEDUSA_PUBLISHABLE_KEY:-}}"

pass=0
fail=0

check() {
  local name="$1"
  local code="$2"
  local expect="$3"
  if echo "$expect" | grep -q "$code"; then
    echo "  OK  $name (HTTP $code)"
    pass=$((pass + 1))
  else
    echo "  FAIL $name (HTTP $code, expected one of: $expect)"
    fail=$((fail + 1))
  fi
}

echo "== Alkemart smoke: onboarding / quality / catalog =="
echo "API=$API"

# Public
code=$(curl -s -o /dev/null -w "%{http_code}" "$API/health" || true)
check "GET /health" "$code" "200"

if [[ -n "$PK" ]]; then
  body=$(curl -s -w "\n%{http_code}" \
    -H "x-publishable-api-key: $PK" \
    "$API/store/alkemart/catalog?limit=5" || echo -e "\n000")
  code=$(echo "$body" | tail -n1)
  json=$(echo "$body" | sed '$d')
  check "GET /store/alkemart/catalog" "$code" "200"
  if [[ "$code" == "200" ]]; then
    echo "$json" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('products') or []
strat=d.get('strategy')
assert strat=='light_ids_then_heavy_page', strat
assert not ps or all(p.get('offer_id') for p in ps), 'missing offer_id'
print(f'  OK  catalog contract strategy={strat} n={len(ps)} cache={d.get(\"cache\")}')
" && pass=$((pass + 1)) || { echo "  FAIL catalog contract"; fail=$((fail + 1)); }
  fi
else
  echo "  SKIP store catalog (set PK or VITE_MEDUSA_PUBLISHABLE_KEY)"
fi

# Auth boundaries (expect 401/403 without token)
code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API/vendor/alkemart/onboarding/status" || true)
check "GET /vendor/alkemart/onboarding/status unauth" "$code" "401 403"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API/admin/alkemart/moderation/summary" || true)
check "GET /admin/alkemart/moderation/summary unauth" "$code" "401 403"

# Authenticated (optional)
if [[ -n "${MEMBER_TOKEN:-}" && -n "${SELLER_ID:-}" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    -H "x-seller-id: $SELLER_ID" \
    "$API/vendor/alkemart/onboarding/status" || true)
  check "GET onboarding/status authed" "$code" "200"
else
  echo "  SKIP member onboarding (set MEMBER_TOKEN + SELLER_ID)"
fi

if [[ -n "${ADMIN_TOKEN:-}" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API/admin/alkemart/moderation/summary" || true)
  check "GET moderation/summary authed" "$code" "200"

  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API/admin/alkemart/moderation/sellers" || true)
  check "GET moderation/sellers authed" "$code" "200"

  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API/admin/alkemart/moderation/products" || true)
  check "GET moderation/products authed" "$code" "200"
else
  echo "  SKIP admin moderation (set ADMIN_TOKEN)"
fi

echo ""
echo "Result: $pass passed, $fail failed"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
