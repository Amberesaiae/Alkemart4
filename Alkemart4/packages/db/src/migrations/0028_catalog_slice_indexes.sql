-- 0028: catalog slice-loader indexes.
-- The storefront snapshot path historically full-scanned 16 tables; targeted
-- slice loaders filter offers / variants by product_id, and listings filter
-- products by status. Postgres does NOT auto-index FK columns, and the only
-- existing offers index is UNIQUE (seller_id, product_id, variant_id), whose
-- leftmost column makes it useless for product_id-only filters.
-- Entirely additive and re-runnable.

CREATE INDEX IF NOT EXISTS offers_product_active_idx
  ON offers (product_id, active);

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON product_variants (product_id);

CREATE INDEX IF NOT EXISTS products_status_created_idx
  ON products (status, created_at DESC);
