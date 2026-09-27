-- 0047: faster listing and product videos (pilot phase 6).
--
-- product_videos: TikTok / Instagram / YouTube links on a seller's listing.
-- We store the platform + id we parsed (never the raw pasted URL as markup)
-- and rebuild the embed ourselves. New links wait for admin approval; admin
-- can feature approved ones in the storefront's "Watch & shop" row.
-- listing_assist_usage: photo spec reads per seller per month (free
-- allowance), counted atomically.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS product_videos (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  seller_id text NOT NULL REFERENCES sellers(id),
  platform text NOT NULL,
  video_id text NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  featured boolean NOT NULL DEFAULT false,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS product_videos_unique_uidx ON product_videos (product_id, platform, video_id);
CREATE INDEX IF NOT EXISTS product_videos_status_idx ON product_videos (status, created_at);

DO $$ BEGIN
  ALTER TABLE product_videos ADD CONSTRAINT product_videos_platform_ck CHECK (platform IN ('youtube', 'tiktok', 'instagram'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE product_videos ADD CONSTRAINT product_videos_status_ck CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS listing_assist_usage (
  seller_id text NOT NULL REFERENCES sellers(id),
  period text NOT NULL,
  photo_reads integer NOT NULL DEFAULT 0,
  PRIMARY KEY (seller_id, period)
);
