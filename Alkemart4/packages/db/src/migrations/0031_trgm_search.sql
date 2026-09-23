-- 0031: typo-tolerant search (pg_trgm) + attribute-value slice index.
-- pg_trgm is a TRUSTED extension (non-superuser installable per PG docs).
-- GIN trigram indexes serve %, ILIKE, and <-> distance ordering. The explicit
-- similarity threshold is set per-transaction (SET LOCAL) by the repository,
-- never globally, so concurrent workloads keep their own tuning.
-- product_attribute_values(product_id) lets search/filter slices load values
-- for matched products instead of full-scanning the fact table.
-- Entirely additive and re-runnable.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_title_trgm_idx
  ON products USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_attribute_values_product_idx
  ON product_attribute_values (product_id);
