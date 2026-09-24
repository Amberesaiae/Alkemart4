-- Multi-image products.
--
-- `products.image_url` stays as the primary/legacy image so every existing
-- reader keeps working; this table holds the ordered gallery. The storefront
-- PDP gallery already renders an array (ProductImageGallery), it was simply
-- never given more than one URL.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS product_images (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  -- Alt text is nullable: a legacy backfill has none, and an empty alt is
  -- more honest than an invented one. New uploads collect it in the UI.
  alt text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gallery reads are always "all images for one product, in order".
CREATE INDEX IF NOT EXISTS product_images_product_position_idx
  ON product_images (product_id, position);

-- One row per (product, url): re-saving a gallery must not duplicate images.
CREATE UNIQUE INDEX IF NOT EXISTS product_images_product_url_key
  ON product_images (product_id, url);
