# Plan 3 exit checklist — Checkout + OrderGroup

**Branch:** `feat/cloudflare-checkout-plan3`  
**Date:** 2026-08-31  
**Plan:** `docs/superpowers/plans/2026-08-31-cloudflare-checkout-plan.md`  
**Scope:** nested `Alkemart4/` (`packages/`, `apps/api`)

| Gate | Status | Evidence |
|---|---|---|
| Cart item requires offerId | ✅ | `apps/api/src/routes/store/cart.test.ts` — body without `offerId` → 400 |
| Two-seller COD → OrderGroup + 2 orders | ✅ | `checkout.test.ts` — COD → 2 seller orders |
| MoMo reserves stock while pending | ✅ | `checkout.test.ts` — `reserved` increments |
| Webhook HMAC reject | ✅ | `hooks/paystack.test.ts` — bad sig → 401 |
| Webhook success creates orders idempotently | ✅ | same — confirm + deduped replay |
| `rg PaymentProvider packages apps/api` empty | ✅ | run from nested `Alkemart4/` |
| No charge without Paystack key (503) | ✅ | `checkout.test.ts` MoMo without key → 503 |

## Supporting verification

```text
$ cd Alkemart4/apps/api && bun run test
 Test Files  11 passed
$ cd Alkemart4 && rg PaymentProvider packages apps/api   # empty
```

## Notes

- Paystack-only: MoMo charge + card initialize/verify + webhook HMAC. No PaymentProvider.
- In-memory checkout repo for tests; Postgres checkout repository not wired for live Hyperdrive yet (follow-up).
- Plan 4 owns fulfillment, payouts, SMS.
