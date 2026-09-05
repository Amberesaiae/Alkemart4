# Lifecycle — Payment

## States (`payment_intents.status`)

`initiated → pending → succeeded → completed`  
Terminals also include `failed | expired | refunded` (refund API not exposed yet).

## Paths

### COD

1. `POST /store/checkout` `method=cod` + shipping  
2. Create intent → `confirmPaidOrder` immediately  
3. Return `orderGroupId`

### MoMo

1. Create intent `initiated` → `pending`  
2. **`reserveStock`**  
3. Paystack charge  
4. Confirm via **webhook** (`POST /hooks/paystack`) and/or **status poll** (`GET /store/checkout/status` → verify)  
5. Fail path: mark failed + **`releaseReservations`**

### Card

1. Create intent `initiated` → `pending`  
2. **Must `reserveStock`** (parity with MoMo)  
3. Paystack initialize → authorization URL  
4. Callback / webhook / status verify → `confirmPaidOrder`  
5. Fail / abandon → release

## Confirm rules

- Amount match against quote / intent  
- Idempotent: second confirm returns existing OrderGroup  
- Webhook HMAC verified; event id deduped in `CATALOG_KV`  
- Multi-seller: one group, N orders, stock decremented per offer line

## Payout

- Admin `POST /admin/payouts` with `sellerId`  
- Eligible: `orders.status = delivered` without `payout_lines`  
- Paystack Transfer using seller `recipient_code` − `commission_bps`

## Launch gate

See `docs/ops/PAYMENTS-LAUNCH-GATE.md` for live MoMo/card money matrix. Lab COD is proven; live money must be re-run before public launch.

## Known gaps

- Abandoned pending intent expiry job  
- Refund / partial refund API  
- Chargeback handling  
