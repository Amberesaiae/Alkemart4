# Plan 1 exit checklist — Multivendor Foundation + Catalog

**Branch:** `feat/cloudflare-multivendor-plan1`  
**Date:** 2026-08-31  
**HEAD:** `4f6653c`

| Gate | Status | Evidence |
|---|---|---|
| Two sellers → one PLP card (`offerCount: 2`) | ✅ | `apps/api` catalog.test.ts (in-memory demo) |
| `fromPricePesewas` = min offer | ✅ | catalog.test + domain catalog tests |
| PDP lists both peer offers | ✅ | products.test.ts |
| Seller shop isolation | ✅ | sellers.test.ts |
| No price/stock on Product schema | ✅ | `packages/db/src/schema/products.ts` |
| Unique offer `(seller, product, variant)` | ✅ | `offers_seller_product_variant_uidx` |
| No major-unit money field in CF DTOs | ✅ | OpenAPI + domain use `*Pesewas` strings |
| No title regex inventing | ✅ | `offer-filter.ts` + tests |
| Dual Hyperdrive bindings | ✅ | `wrangler.toml` (placeholder IDs) |
| Medusa backend untouched | ✅ | no diffs under `apps/backend` |
| Domain tests | ✅ | 25/25 |
| API route tests | ✅ | 7/7 |
| Storefront focused tests | ✅ | 14/14 + `tsc --noEmit` |
| Live migrate / wrangler smoke | ⚠️ deferred | no `DATABASE_URL` / Hyperdrive IDs |

## Deferred minors

- PLP card ATC still uses `bestOfferId` when `offerCount > 1` (PDP requires pick)
- Postgres catalog repo loads full snapshot per request
- Live Neon migrate + wrangler dev blocked on credentials/placeholders
