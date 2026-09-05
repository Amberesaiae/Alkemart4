#!/usr/bin/env bash
# E2E API smoke for Workers + gold demo accounts.
# Usage: ./scripts/e2e-workers-smoke.sh
set -euo pipefail

API="${ALKEMART_API_URL:-https://alkemart-api.glean-circular-passport.workers.dev}"
UA="Mozilla/5.0 AlkemartE2E/1.0"

json_get() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"
}

echo "== health =="
curl -sS -A "$UA" "$API/health" | json_get 'd.get("ok")'
curl -sS -A "$UA" -o /tmp/ready.json -w "ready_http=%{http_code}\n" "$API/health/ready" || true

echo "== buyer login =="
TOKEN=$(curl -sS -A "$UA" -X POST "$API/store/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"buyer@alkemart.test","password":"BuyerPass1"}' | json_get 'd["token"]')
test -n "$TOKEN"

echo "== catalog search =="
curl -sS -A "$UA" "$API/store/catalog?q=tecno&limit=1" | json_get 'd["items"][0]["title"]'

echo "== COD checkout =="
CART=$(curl -sS -A "$UA" -X POST "$API/store/cart" | json_get 'd["cartId"]')
OFFER=$(curl -sS -A "$UA" "$API/store/catalog?limit=1" | json_get 'd["items"][0]["bestOfferId"]')
curl -sS -A "$UA" -X POST "$API/store/cart/$CART/items" \
  -H 'content-type: application/json' \
  -d "{\"offerId\":\"$OFFER\",\"qty\":1}" >/dev/null
CHECKOUT=$(curl -sS -A "$UA" -X POST "$API/store/checkout" \
  -H 'content-type: application/json' \
  -d "{\"cartId\":\"$CART\",\"method\":\"cod\",\"buyerEmail\":\"buyer@alkemart.test\",\"shippingAddress\":{\"first_name\":\"Ama\",\"last_name\":\"Mensah\",\"phone\":\"0244123456\",\"address_1\":\"12 High St\",\"city\":\"Accra\",\"country_code\":\"gh\"}}")
OG=$(echo "$CHECKOUT" | json_get 'd["orderGroupId"]')
test -n "$OG"
curl -sS -A "$UA" -o /dev/null -w "order_detail=%{http_code}\n" \
  "$API/store/orders/$OG" -H "Authorization: Bearer $TOKEN"

echo "== vendor =="
VTOKEN=$(curl -sS -A "$UA" -X POST "$API/vendor/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"vendor@alkemart.test","password":"VendorPass1"}' | json_get 'd["token"]')
curl -sS -A "$UA" "$API/vendor/products" -H "Authorization: Bearer $VTOKEN" \
  | json_get 'len(d.get("items") or [])'

echo "== admin =="
ATOKEN=$(curl -sS -A "$UA" -X POST "$API/admin/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"admin@alkemart.test","password":"AdminPass1"}' | json_get 'd["token"]')
curl -sS -A "$UA" "$API/admin/orders?limit=3" -H "Authorization: Bearer $ATOKEN" \
  | json_get 'len(d.get("items") or [])'

if [ "${SKIP_PAGES:-}" = "1" ]; then
  echo "== pages skipped (SKIP_PAGES=1) =="
else
  echo "== pages =="
  for u in \
    https://alkemart4-storefront.pages.dev \
    https://alkemart4-vendor.pages.dev \
    https://alkemart4-admin.pages.dev
  do
    code=$(curl -sS -o /dev/null -w '%{http_code}' -A "$UA" "$u")
    echo "$u -> $code"
    test "$code" = "200"
  done
fi

echo "E2E_SMOKE_OK"
