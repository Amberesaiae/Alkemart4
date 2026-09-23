# Tenant isolation (RLS)

**Status:** Mechanism live (migration 0029); runtime rollout in progress.
**Rule:** seller B's rows must be *structurally* unreadable to seller A, even
through a future bug that drops an app-level `WHERE`. App scoping is the seat
belt; RLS is the airbag.

## Mechanism

- Dedicated `seller_api` role; `seller_isolation` policies on `offers`,
  `orders`, `order_items`, `payouts`, `payout_holds` compare one row column:
  `seller_id = current_setting('app.seller_id', true)`.
- Policies apply `TO seller_api` only — owner connections (storefront reads,
  admin, platform jobs) are unaffected. No `PUBLIC` policies exist.
- `WITH CHECK` = `USING` (implicit), so writes fence identically to reads.
- `products`/`product_variants` deliberately excluded for now: product identity
  is shared (`seller_id` nullable) and the storefront must read all sellers'
  rows. Vendor write paths scope by seller at app level (existing behavior);
  product write-fencing is explicit follow-up below.

## Runtime pattern

```ts
// Vendor-scoped request path: fence this unit of work to one seller.
await db.unsafe(`SET LOCAL ROLE seller_api; SET LOCAL app.seller_id = '${sellerId}'`)
// …queries here see only that seller's rows…
```

`SET LOCAL` is transaction-scoped — the fence cannot leak across requests.
Every new vendor read/write path must enter through this pattern (see rollout).

## Rollout checklist

- [x] Migration 0029 (role, grants, 5 policies) — applied 2026-09-23
- [x] `rls.test.ts` allow/deny matrix (runs live against pooler, rolled back;
  live proof pending a network window — suite skips cleanly without it)
- [ ] Vendor orders paths fenced
- [ ] Vendor offers/products write paths fenced
- [ ] Vendor payouts paths fenced
- [ ] `products` write-fence design (shared-identity NULL rows)
- [ ] `payout_lines` coverage (no direct seller_id — join-gated or app-scoped)

## Verification

`bun run test:rls` (live DB, fully rolled back — inserts never persist).
Asserts: A sees only A's rows; cross-seller UPDATE touches 0 rows;
cross-seller INSERT raises; switching the setting flips visibility; the owner
connection still sees everything.
