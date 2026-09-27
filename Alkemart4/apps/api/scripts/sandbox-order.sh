#!/usr/bin/env bash
# Place a buyer order on the SANDBOX API exactly as storefront checkout does.
# Usage: apps/api/scripts/sandbox-order.sh [offerId] [qty] [method]
set -euo pipefail
API=${SANDBOX_API:-http://127.0.0.1:8788}
OFFER=${1:-offer-a}; QTY=${2:-1}; METHOD=${3:-cod}
CART=$(curl -sf -X POST "$API/store/cart" | python3 -c 'import json,sys;print(json.load(sys.stdin)["cartId"])')
curl -sf -X POST "$API/store/cart/$CART/items" -H 'content-type: application/json' -d "{\"offerId\":\"$OFFER\",\"qty\":$QTY}" >/dev/null
curl -sf -X POST "$API/store/checkout" -H 'content-type: application/json' -d "{
  \"cartId\":\"$CART\",\"method\":\"$METHOD\",\"buyerEmail\":\"buyer@sandbox.test\",
  \"shippingAddress\":{\"first_name\":\"Ama\",\"last_name\":\"Test\",\"phone\":\"0241234567\",
  \"address_1\":\"1 Sandbox Street\",\"city\":\"Osu\",\"province\":\"Greater Accra\",\"country_code\":\"gh\"}}"
echo
