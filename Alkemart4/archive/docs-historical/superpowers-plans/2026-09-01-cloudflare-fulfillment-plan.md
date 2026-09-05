# Cloudflare Ghana Multivendor Marketplace — Plan 4: Fulfillment + Payouts + Cutover

> **For agentic workers:** Implement task-by-task. Prefer inline execution for speed.

**Goal:** Per-seller order fulfillment (ship/deliver), Paystack Transfer payouts with commission, returns/disputes tables, cutover checklist.

**Architecture:** Vendor-scoped fulfillment on `/vendor/orders`. Admin `/admin/payouts`. Payout lines = delivered order subtotals − `commission_bps`. Paystack Transfer only — no PaymentProvider.

**Tech Stack:** Hono, Drizzle, Vitest, Zod, `@alkemart/paystack`

**Spec:** `docs/superpowers/specs/2026-08-31-cloudflare-ghana-marketplace-design.md` (§5 payouts, §8 phases 5–6)

**Depends on:** Plan 3 on `main` (`a2920ef`)

## Global Constraints

- Paystack only for transfers/refunds
- Pesewas end-to-end
- Fulfillment/payout never cross seller boundaries
- Commission from `sellers.commission_bps` only at payout generation
- Nested `Alkemart4/` paths

---

### Task 1: Schema — fulfillment + payouts + returns

Expand `order_status`: `placed | shipped | delivered | cancelled`
Tables: `payouts`, `payout_lines`, `returns` (minimal)
Migration `0004_*.sql`

Commit: `feat(db): fulfillment payouts returns schema`

### Task 2: Domain — fulfillment transitions + payout math

```ts
assertFulfillmentTransition(from, to)
computePayoutLines(orders: { id, sellerId, subtotalPesewas }[], commissionBps: number)
// net = subtotal * (10000 - bps) / 10000
```

Commit: `feat(domain): fulfillment transitions and payout computation`

### Task 3: Paystack transfer

```ts
createPaystackTransfer(cfg, { amountPesewas, recipientCode, reference, reason? })
```

Commit: `feat(paystack): create transfer for seller payouts`

### Task 4: Vendor fulfill + admin payout API

- `GET /vendor/orders` — seller’s orders only
- `POST /vendor/orders/:id/ship` | `/deliver`
- `POST /admin/payouts` `{ sellerId }` — all delivered unpaid → Paystack transfer; 503 if no key/recipient
- Tests: cross-seller 404; deliver then payout nets commission; missing key 503

Commit: `feat(api): vendor fulfillment and admin Paystack payouts`

### Task 5: OpenAPI + cutover checklist

- OpenAPI 0.4.0 + client regen
- `docs/superpowers/plans/2026-09-01-cloudflare-plan4-exit-checklist.md`
- Cutover rule doc section: hard switch writes; archive Medusa; no dual writers

Commit: `docs: Plan 4 fulfillment payouts cutover checklist and OpenAPI`
