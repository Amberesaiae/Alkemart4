---
name: Alkemart promo usage-limit locking
description: How concurrent checkout promo-limit races are prevented with a FOR UPDATE row lock
---

# Promotion usage-limit race prevention

## The rule
`validateAndComputePromotionDiscount` in `lib/promotions.ts` acquires a `FOR UPDATE` row lock on the promotions row before counting existing redemptions. This serializes concurrent checkout transactions against the same promo code — the second transaction blocks until the first commits (or rolls back), so it sees the committed redemption count before deciding whether the limit has been reached.

**Why:** Without the lock, two concurrent transactions both pass the `count(*) < usageLimit` check before either inserts a redemption, allowing usage-limit overshoot. The `FOR UPDATE` lock is a no-op when called outside a transaction (e.g. `quoteCart`), so it only costs a round-trip inside the commit path.

**How to apply:** The lock only works when `validateAndComputePromotionDiscount` is called from within a Drizzle transaction (`tx`). The checkout path always does this (step 1.5 is inside `db.transaction`). If a new code path calls this outside a transaction and needs race-safe enforcement, wrap it in a transaction first.
