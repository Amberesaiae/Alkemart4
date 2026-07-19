# Seller product isolation (Rena Jewels / “hardcoded products”)

**Date:** 2026-07-19  
**Symptom:** New seller shops (e.g. **Rena / renajewel**) showed lab products (tomatoes, soap, phone, ankara, plantain, water) they never created.

## Root cause — not a race

Mercur `GET /vendor/products` applies `applySellerProductLinkFilter`:

```text
products WHERE
  id ∈ seller_owned_ids
  OR (status = published AND id ∉ products_restricted_to_other_sellers)
```

`products_restricted_to_other_sellers` = any product that has **at least one** `product_seller` row and is **not** linked to this seller.

Therefore **published products with zero `product_seller` rows are shared with every seller** — intentional “master catalog / multi-offer” behavior in Mercur.

Lab seeds left many published products **without** `product_seller` after demo purge. New shops (and Amberstone) listed them as if owned. That looks like “hardcoded” products, but it is **shared-catalog leakage**, not concurrent create race.

Storefront catalog was already honest (only products with offers + sellable path): count 1 (Amberstone palm oil).

## Fix

1. **Data:** soft-delete orphan published products with no `product_seller` (lab seeds).
2. **API:** Alkemart middleware `applyStrictSellerProductFilter` on `GET /vendor/products` — list only:
   - `product_seller` for this seller, or
   - products authored by this seller (`product_change` / actions)
3. **Create:** `product-created-link-seller` workflow hook always creates `product_seller` for the creating seller (Mercur only linked when `seller_ids` was set).

## Code map

| Piece | Path |
|-------|------|
| List filter middleware | `packages/api/src/api/middlewares/strict-seller-products.ts` |
| Registered | `packages/api/src/api/middlewares.ts` → `GET /vendor/products` |
| Create → always `product_seller` | `packages/api/src/workflows/hooks/product-created-link-seller.ts` |
| Unit | `packages/api/src/lib/__tests__/strict-seller-products.unit.spec.ts` |
| Live e2e (Playwright RBAC) | `e2e/tests/rbac-multivendor.live.spec.ts` phase 1 |
| Curl human e2e | `scripts/live-e2e-human-flows.sh` (after vendor login) |

## Verify

```bash
# API up
curl -s http://127.0.0.1:9000/health

# Amberstone should only see own products
curl -s -H "authorization: Bearer $VT" -H "x-seller-id: $SID" \
  "$API/vendor/products?limit=50&fields=id,title"

# Unit
cd packages/api && bun test src/lib/__tests__/strict-seller-products.unit.spec.ts

# RBAC live (servers up)
cd e2e && bun run test:rbac
```

Empty new shop → `count: 0` products until they create one.

## Performance (pragmatic, 2026-07-19)

**Problem:** seller product list was **~18s** for one SKU. Isolation was correct but the middleware also probed `product_change` / `product_change_action`; those graphs often hang on Neon free tier.

**Fix:**

1. Ownership = **`product_seller` only** (one query). Create hook always writes the link.
2. Optional Redis cache of owned ids (~45s TTL) — `lib/seller-owned-products-cache.ts`.
3. Authorship fallback only if `STRICT_SELLER_INCLUDE_AUTHORSHIP=1`.
4. Light list API: **`GET /vendor/alkemart/products`** (exclusive + lean fields) — prefer over Mercur `/vendor/products` for new UI.
5. Readiness Redis cache + banner min 45s poll (stop hammering Neon).

**Measured (Neon free, warm-ish, 2026-07-19):** any authenticated vendor route still often **~13–16s** floor — middleware + DB RTT dominate. Isolation is correct (Amberstone sees only palm oil). **P0 Neon always-on** is the real latency fix. See [performance practices](./2026-07-19-performance-practices.md).
