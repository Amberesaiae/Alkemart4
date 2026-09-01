# Plan 4 exit checklist — Fulfillment + Payouts + Cutover

**Branch:** `feat/cloudflare-fulfillment-plan4`  
**Date:** 2026-09-01  
**Plan:** `docs/superpowers/plans/2026-09-01-cloudflare-fulfillment-plan.md`

| Gate | Status | Evidence |
|---|---|---|
| Vendor ship/deliver own order | ✅ | `vendor/orders.test.ts` |
| Cross-seller fulfill → 404 | ✅ | same |
| Admin payout nets commission via Paystack Transfer | ✅ | `admin/payouts.test.ts` net `1395` @ 700 bps |
| Missing Paystack key → 503 on payout | ✅ | same |
| `rg PaymentProvider packages apps/api` empty | ✅ | nested `Alkemart4/` |
| Returns/disputes tables present | ✅ | migration `0004_breezy_ozymandias.sql` |

## Cutover rule (binding)

1. **Hard switch writes** — Cloudflare Workers API is the only production writer.
2. Freeze Medusa/Mercur writes; move `apps/backend` to `archive/` when DNS cuts over.
3. **No dual production writers.**
4. Warm catalog reads / ETL as needed before switch; rollback = revert DNS + re-enable archived API (document in deploy runbook).
5. Paystack webhook URL must point at Workers `/hooks/paystack` before MoMo traffic.

## Deferred

- Live Postgres fulfillment/payout repository (in-memory for tests)
- SMS/WA notification queue consumers
- Return workflow HTTP routes (schema only in v1)
