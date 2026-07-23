---
name: Paystack charge-before-order pattern
description: How to sequence a Paystack mobile money charge relative to order creation in a synchronous checkout
---

For a synchronous (no webhook/queue) checkout, call Paystack's `/charge` endpoint for mobile money **before** starting the DB transaction that reserves stock and creates the order. Only proceed to create the order if the response's `data.status === "success"`; anything else (declined, pending authorization, network error) must throw and skip order creation entirely.

**Why:** Paystack mobile money charges are normally asynchronous in production (the buyer approves a USSD/prompt), but resolve synchronously in sandbox/test mode. Either way, the order must never be confirmed for a charge that wasn't actually approved — creating the order first and charging after (or charging inside the transaction and rolling back on failure) risks either a false "paid" order or a captured charge with no corresponding order if a later step (e.g. stock check) fails.

**How to apply:** Compute the cart total via a read-only quote function (no stock reservation) to know the amount to charge, charge Paystack for that amount, capture the returned reference, then pass it into the order-creating transaction to record against the payment ledger. A charge that succeeds but is followed by an unrelated transaction failure (e.g. stock sold out in the interim) leaves a captured charge with no order — worth a follow-up for automatic refund/reconciliation rather than solving inline.
