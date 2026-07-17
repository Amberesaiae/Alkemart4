# Commerce stats SQL (Neon / Metabase)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Status** | Ops helpers — not a data warehouse |
| **API** | `GET /admin/alkemart/stats` + `medusa exec ./src/scripts/print-commerce-stats.ts` |

## Prefer the API first

For day-to-day ops, use the admin stats endpoint (order counts, GMV-by-currency, catalog).  
Wire Metabase only when you need ad-hoc SQL / charts.

## Example APL-style Postgres (Medusa v2 table names vary by version)

Confirm table names with `\dt` in `psql` against `alkemart_marketplace`.  
Typical Medusa order totals live on `order` / `order_summary` style tables.

```sql
-- Order count by day (adjust table names after \dt)
SELECT date_trunc('day', created_at) AS day, count(*) AS orders
FROM "order"
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;
```

```sql
-- Rough GMV by currency (if total is stored as numeric major units)
SELECT currency_code, count(*) AS orders, sum(total::numeric) AS gmv
FROM "order"
WHERE deleted_at IS NULL
GROUP BY 1;
```

## Metabase setup (optional)

1. Connect Metabase to Neon **read** credentials (prefer a read-only role).  
2. Never point Metabase at Express-era `neondb` as the Mercur SoR.  
3. Dashboard cards: orders/day, GMV by currency, open sellers.

## Mode B note

MoMo charges may exist in Paystack without being “production ready” in product marketing.  
Stats should not claim settlement completeness until the money spine is Mode A.
