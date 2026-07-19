-- P1.3 marketplace indexes (idempotent).
-- Safe to re-run on Neon / any Postgres 13+.
-- Core four are usually created by Medusa/Mercur migrations; this script
-- fills gaps and adds Alkemart composites for catalog + seller isolation.
--
-- Apply:
--   neonctl psql medusa-prod --project-id wispy-union-10280789 \
--     --database-name alkemart_marketplace \
--     < scripts/ensure-p13-marketplace-indexes.sql
-- Or:
--   bash scripts/ensure-p13-marketplace-indexes.sh

-- ─── P1.3 required (partial indexes match Medusa/Mercur style) ───────

CREATE INDEX IF NOT EXISTS "IDX_offer_seller_id"
  ON public.offer USING btree (seller_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS "IDX_offer_product_id"
  ON public.offer USING btree (product_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS "IDX_product_status"
  ON public.product USING btree (status)
  WHERE (deleted_at IS NULL);

-- product_seller link table (Mercur name may be hashed; ensure seller_id path)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_seller'
  ) THEN
    -- Prefer explicit alkemart name if Mercur hash index missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'product_seller'
        AND indexdef ILIKE '%(seller_id)%'
    ) THEN
      EXECUTE $i$
        CREATE INDEX "IDX_alkemart_product_seller_seller_id"
          ON public.product_seller USING btree (seller_id)
          WHERE (deleted_at IS NULL)
      $i$;
    END IF;
  END IF;
END $$;

-- ─── Alkemart composites (catalog heavy pass + vendor offer lists) ───

CREATE INDEX IF NOT EXISTS "IDX_alkemart_offer_seller_product"
  ON public.offer USING btree (seller_id, product_id)
  WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS "IDX_alkemart_offer_product_seller"
  ON public.offer USING btree (product_id, seller_id)
  WHERE (deleted_at IS NULL);

-- Category → products reverse lookup (PK is product_id, product_category_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_category_product'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'product_category_product'
        AND (
          indexdef ILIKE '%(product_category_id)%'
          OR indexdef ILIKE '%(product_category_id,%'
        )
        AND indexname <> 'product_category_product_pkey'
    ) THEN
      -- No deleted_at on many join tables; plain btree is fine
      EXECUTE $i$
        CREATE INDEX "IDX_alkemart_pcp_category_id"
          ON public.product_category_product USING btree (product_category_id)
      $i$;
    END IF;
  END IF;
END $$;

-- ─── Verify ──────────────────────────────────────────────────────────

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname IN (
      'IDX_offer_seller_id',
      'IDX_offer_product_id',
      'IDX_product_status',
      'IDX_alkemart_offer_seller_product',
      'IDX_alkemart_offer_product_seller',
      'IDX_alkemart_pcp_category_id',
      'IDX_alkemart_product_seller_seller_id'
    )
    OR (tablename = 'product_seller' AND indexdef ILIKE '%seller_id%')
  )
ORDER BY tablename, indexname;
