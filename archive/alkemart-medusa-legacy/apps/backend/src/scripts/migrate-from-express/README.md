# migrate-from-express

One-way ETL: **Express Drizzle tables on Neon → Medusa**.

This is the **production catalog path**. Do **not** run `seed-ghana` / `seed-vendors` in production — those are dev fixtures only.

## Prerequisites

1. Medusa Neon `DATABASE_URL` migrated and booting.
2. Commerce infrastructure already bootstrapped (no catalog):

   ```bash
   npx medusa exec ./src/scripts/bootstrap-commerce-context.ts
   ```

   Creates: Ghana region, **Alkemart Storefront** sales channel, **Alkemart Accra Warehouse** stock location, shipping, publishable key.

3. Express source URL available to the machine running ETL.

## Required env

| Variable | Role |
|---|---|
| `DATABASE_URL` | Medusa target (runtime). ETL writes here via Medusa modules/workflows. |
| `EXPRESS_DATABASE_URL` | Express Drizzle **source** (ETL read-only). Prefer this over sharing `DATABASE_URL`. |
| `ALLOW_EXPRESS_MIGRATE` | **Required `true` when `NODE_ENV=production`**. Safety guard. |
| `NODE_ENV` | `production` refuses migrate unless `ALLOW_EXPRESS_MIGRATE=true`. |

Fallback: if `EXPRESS_DATABASE_URL` is unset, scripts use `DATABASE_URL` as the Express source (local/transitional only — not recommended for cutover).

Connection strings are **never logged in full** (host + db path only).

## Money

| Express | Medusa |
|---|---|
| `products.price_pesewas` (integer, e.g. `189900`) | Variant price `amount` = **pesewas / 100** major GHS (e.g. `1899`) |

Medusa v2.17 Store API returns `calculated_price.calculated_amount` in **major GHS**, not pesewas. See `money.ts`.

## Idempotency keys

| Job | Source | Target | Key |
|---|---|---|---|
| `01-categories.ts` | `categories` | product categories | `slug` → `handle` |
| `02-vendors.ts` | `vendors` | marketplace `Vendor` | `slug` |
| `03-products.ts` | `products` (+ join vendors/categories) | product + default variant + GHS price + inventory + SC + vendor link | `slug` → `handle` |

Re-runs **update** existing rows (name/price/stock/links) rather than duplicating.

## How to run

From `alkemart-medusa/apps/backend`:

```bash
# Optional: explicit Express source
export EXPRESS_DATABASE_URL='postgresql://…@…neon.tech/neondb?sslmode=require'

# Production only:
export ALLOW_EXPRESS_MIGRATE=true

# Preferred: full catalog pipeline
npx medusa exec ./src/scripts/migrate-from-express/run-all.ts

# Or step-by-step (same order)
npx medusa exec ./src/scripts/migrate-from-express/01-categories.ts
npx medusa exec ./src/scripts/migrate-from-express/02-vendors.ts
npx medusa exec ./src/scripts/migrate-from-express/03-products.ts
```

### Empty source

If Express tables are missing or empty, scripts **exit 0** and log e.g.  
`no source products — nothing to migrate`.

## Mapping notes

### Categories (`01`)

- Columns: `id, slug, name, parent_id, icon_key, sort_order`
- Parent categories created/resolved before children when possible
- Metadata: `express_category_id`, `icon_key`

### Vendors (`02`)

| Express | Marketplace Vendor |
|---|---|
| `slug` | `slug` |
| `name` | `name` |
| `bio` | `bio` |
| `commission_bps` | `commission_bps` |
| `status` | `status` |
| `badge_top_seller` | `badge_top_seller` |
| `badge_fast_shipper` | `badge_fast_shipper` |
| `paystack_recipient_code` | `paystack_recipient_code` |
| `rating_avg_x100` / `rating_count` | same |

### Products (`03`)

- Only `is_active = true`
- `handle = slug`
- Create via `createProductsWorkflow`; update via `updateProductsWorkflow` + price upsert
- Inventory `stocked_quantity` = Express `stock` at Accra stock location (name match **Alkemart Accra Warehouse**, else first location matching /Accra/i, else first location)
- Linked to **Alkemart Storefront** sales channel
- Category by `category_slug` handle
- Vendor-product module link by `vendor_slug` when marketplace vendor exists
- Prints counts: `read, created, updated, skipped, errors`

Does **not** insert fake Samsung/seed catalog rows — only Express source rows.

## Production notes

1. Prefer a **dedicated Medusa Neon database/branch** (`alkemart_medusa`); keep Express on its DB until cutover (ADR-P1).
2. Dry-run on staging: report row counts + spot-check ~20 products (price GHS = pesewas/100, stock, vendor).
3. Freeze Express catalog writes before final delta ETL.
4. Set `ALLOW_EXPRESS_MIGRATE=true` only for the migration job/window; unset afterward.
5. Images (`images` table object paths) are **not** fully migrated in this scaffold — thumbnails can be added in a follow-up when public CDN URLs are stable.
6. Customers / homepage / open orders are later ETL jobs (plan §4.2) — not in this package yet.

## Files

| File | Purpose |
|---|---|
| `db-source.ts` | `pg` Client helpers for Express Neon |
| `money.ts` | pesewas ↔ major GHS |
| `guard.ts` | production allow-list + shared names |
| `01-categories.ts` | categories ETL |
| `02-vendors.ts` | vendors ETL |
| `03-products.ts` | products ETL |
| `run-all.ts` | ordered runner |
