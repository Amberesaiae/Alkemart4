#!/usr/bin/env bash
# ACID lifecycle smoke against Workers API (extends e2e-workers-smoke).
# Usage: ./scripts/e2e-workers-acid.sh
# Optional: ALKEMART_API_URL=... SKIP_PAYSTACK=1
set -euo pipefail

API="${ALKEMART_API_URL:-https://alkemart-api.glean-circular-passport.workers.dev}"
UA="Mozilla/5.0 AlkemartAcidE2E/1.0"
SHIP='{"first_name":"Ama","last_name":"Mensah","phone":"0244123456","address_1":"12 High St","city":"Accra","country_code":"gh"}'

json_get() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"
}

json_get_opt() {
  python3 -c "import sys,json; d=json.load(sys.stdin); v=($1); print(v if v is not None else '')"
}

echo "== 0 health =="
curl -sS -A "$UA" "$API/health" | json_get 'd.get("ok")'
READY=$(curl -sS -A "$UA" "$API/health/ready" || true)
echo "$READY" | json_get_opt 'd.get("ok")' >/dev/null || true

echo "== 1 buyer COD gold =="
TOKEN=$(curl -sS -A "$UA" -X POST "$API/store/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"buyer@alkemart.test","password":"BuyerPass1"}' | json_get 'd["token"]')
test -n "$TOKEN"
CART=$(curl -sS -A "$UA" -X POST "$API/store/cart" | json_get 'd["cartId"]')
OFFER=$(curl -sS -A "$UA" "$API/store/catalog?limit=1" | json_get 'd["items"][0]["bestOfferId"]')
test -n "$OFFER"
curl -sS -A "$UA" -X POST "$API/store/cart/$CART/items" \
  -H 'content-type: application/json' \
  -d "{\"offerId\":\"$OFFER\",\"qty\":1}" >/dev/null
CHECKOUT=$(curl -sS -A "$UA" -X POST "$API/store/checkout" \
  -H 'content-type: application/json' \
  -d "{\"cartId\":\"$CART\",\"method\":\"cod\",\"buyerEmail\":\"buyer@alkemart.test\",\"shippingAddress\":$SHIP}")
OG=$(echo "$CHECKOUT" | json_get 'd["orderGroupId"]')
test -n "$OG"
DETAIL=$(curl -sS -A "$UA" "$API/store/orders/$OG" -H "Authorization: Bearer $TOKEN")
echo "$DETAIL" | json_get 'd.get("shippingAddress") or d.get("shipping_address") or d.get("id")'
ORDERS_N=$(echo "$DETAIL" | json_get 'len(d.get("orders") or d.get("items") or [1])')
echo "order_group=$OG orders_or_items=$ORDERS_N"

echo "== 2 empty cart checkout must 400 =="
EMPTY=$(curl -sS -A "$UA" -X POST "$API/store/cart" | json_get 'd["cartId"]')
CODE=$(curl -sS -A "$UA" -o /tmp/acid-empty.json -w '%{http_code}' -X POST "$API/store/checkout" \
  -H 'content-type: application/json' \
  -d "{\"cartId\":\"$EMPTY\",\"method\":\"cod\",\"buyerEmail\":\"buyer@alkemart.test\",\"shippingAddress\":$SHIP}")
test "$CODE" = "400" -o "$CODE" = "422" -o "$CODE" = "409"

echo "== 3 vendor + admin chain (read paths) =="
VTOKEN=$(curl -sS -A "$UA" -X POST "$API/vendor/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"vendor@alkemart.test","password":"VendorPass1"}' | json_get 'd["token"]')
VCOUNT=$(curl -sS -A "$UA" "$API/vendor/products" -H "Authorization: Bearer $VTOKEN" \
  | json_get 'len(d.get("items") or [])')
echo "vendor_products=$VCOUNT"
test "$VCOUNT" -ge 1

ATOKEN=$(curl -sS -A "$UA" -X POST "$API/admin/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"admin@alkemart.test","password":"AdminPass1"}' | json_get 'd["token"]')
AC=$(curl -sS -A "$UA" "$API/admin/orders?limit=3" -H "Authorization: Bearer $ATOKEN" \
  | json_get 'len(d.get("items") or [])')
echo "admin_orders_sample=$AC"

echo "== 4 catalog search =="
TITLE=$(curl -sS -A "$UA" "$API/store/catalog?q=tecno&limit=1" | json_get 'd["items"][0]["title"]')
echo "search_hit=$TITLE"
test -n "$TITLE"

echo "== 5 pages HTTP =="
for u in \
  https://alkemart4-storefront.pages.dev \
  https://alkemart4-vendor.pages.dev \
  https://alkemart4-admin.pages.dev
do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -A "$UA" "$u")
  echo "$u -> $code"
  test "$code" = "200"
done

if [ "${SKIP_PAYSTACK:-}" = "1" ]; then
  echo "== skip MoMo/card live Paystack scenarios (SKIP_PAYSTACK=1) =="
else
  echo "== note: MoMo/card webhook ACID scenarios require lab Paystack keys; see PAYMENTS-LAUNCH-GATE.md =="
fi

echo "E2E_ACID_OK"
echo "Covered: health, buyer COD+detail, empty-checkout reject, vendor products, admin orders, search, Pages."
echo "Deferred to Paystack lab matrix: MoMo reserve/confirm/fail, webhook replay, card reserve, payout uniqueness."
