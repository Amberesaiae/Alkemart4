# Payments launch gate (Workers + Paystack)

## Must pass before public MoMo/card

1. `PAYSTACK_SECRET_KEY` set on Worker (live key only for production).
2. Paystack webhook URL: `https://alkemart-api.glean-circular-passport.workers.dev/hooks/paystack`
3. Webhook secret matches Worker secret; only `charge.success` / `paymentrequest.success` confirm orders.
4. Storefront pending poll: `GET /store/checkout/status?cartId=` verifies Paystack when webhook is late.
5. Failed charges mark intent `failed` and release reservations.
6. Manual test matrix:

| Path | Expect |
|------|--------|
| COD | Immediate `orderGroupId`, address on order detail |
| MoMo success | Pending UI → completed via webhook **or** status poll verify |
| MoMo decline | Status `failed`; stock reservation released |
| Card redirect | Callback page polls status → order detail |
| Replay webhook | `deduped: true`, no double OrderGroup |

7. Payouts: admin trigger with real recipient code on an `open` seller; confirm Paystack transfer in dashboard.

## Shopper flags

- MoMo UI: `VITE_FEATURE_MOMO_LAB=true` (default off until gate passes).
- Card UI: on by default (`VITE_FEATURE_CARD`); turn off with `=0` if Paystack card not ready.

## Not done yet (still block launch)

- Automated expire job for abandoned pending intents
- Refund / partial refund API
- Chargeback handling
