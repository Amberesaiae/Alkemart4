-- 0027: product slugs for human-readable URLs (/product/{slug}-{id}).
-- Slug is the URL handle; the trailing UUID stays authoritative for lookup,
-- so slugs never need global RegExp uniqueness rituals beyond a UNIQUE index
-- with deterministic dedup suffixes. Backfills existing rows from titles.
-- Entirely additive and re-runnable.

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: slugify title (lowercase, non-alnum → hyphen, trim, cap 60).
UPDATE products
SET slug = NULLIF(
  substring(
    trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')),
    1, 60
  ),
  ''
)
WHERE slug IS NULL;

-- Empty titles (or titles with no latin alnum) fall back to product- prefix.
UPDATE products
SET slug = 'product-' || substring(id, 1, 8)
WHERE slug IS NULL OR slug = '';

-- Deterministic dedup: later duplicates (by created_at, then id) get -2, -3…
WITH ranked AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS rn
  FROM products
)
UPDATE products p
SET slug = ranked.slug || '-' || ranked.rn
FROM ranked
WHERE p.id = ranked.id AND ranked.rn > 1;

-- Any residual collision (e.g. backfill raced an insert) resolves with id suffix.
UPDATE products p
SET slug = p.slug || '-' || substring(p.id, 1, 8)
WHERE EXISTS (
  SELECT 1 FROM products q WHERE q.slug = p.slug AND q.id <> p.id
);

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_uidx ON products (slug);
