-- 0035: pinpoint seller location.
--
-- `pack_region` answers "same region or not", which cannot rank a shop in
-- Osu above one in Kasoa for a buyer in Labone. Coordinates make distance a
-- real number, which is what "near me" needs and what deliverability ranking
-- is built on.
--
-- Nullable throughout: a seller who has not set a pin keeps working exactly as
-- before and simply never shows a distance. Accuracy is metres as reported by
-- the device, stored for transparency, not used for ranking.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy_m integer,
  ADD COLUMN IF NOT EXISTS location_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS district text;

-- Bounding-box guard: a mistyped or swapped pair must not become a pin that
-- silently ranks a shop into the wrong half of the country.
DO $$ BEGIN
  ALTER TABLE sellers ADD CONSTRAINT sellers_coords_in_ghana
    CHECK (
      (lat IS NULL AND lng IS NULL)
      OR (lat BETWEEN 4.0 AND 11.8 AND lng BETWEEN -3.8 AND 1.8)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only pinned sellers are ever scanned for proximity.
CREATE INDEX IF NOT EXISTS sellers_coords_idx ON sellers (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
