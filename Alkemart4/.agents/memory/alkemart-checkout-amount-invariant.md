---
name: Alkemart checkout charge/amount invariant
description: How the momo charge amount is validated against the DB-computed order total at commit time
---

# Checkout charge/amount invariant

## The rule
`runCheckoutWorkflow` accepts an optional `chargedAmountPesewas` parameter. When provided (momo only), it compares this against `totalPesewas` computed inside the Postgres transaction. If they differ, it throws `ChargeAmountMismatchError` — the transaction aborts, and the caller (`/checkout` route) refunds the captured charge.

**Why:** `quoteCart` (run before the Paystack charge) and the checkout transaction both compute totals from live DB state. If prices or promotions change between the two (race window), the charged amount and the order total could diverge — creating a confirmed order for the wrong amount. The invariant closes this window.

**How to apply:** Any future checkout flow variant that charges externally before creating the order must pass the charged amount into `runCheckoutWorkflow` so the invariant check runs inside the transaction. `ChargeAmountMismatchError` is in `lib/checkout.ts` — handle it by refunding and returning 409.
