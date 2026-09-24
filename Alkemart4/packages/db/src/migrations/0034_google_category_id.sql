-- 0034: Google product category mapping.
--
-- Google publishes its taxonomy as a free file of ~5,600 numeric IDs
-- (taxonomy-with-ids.en-US.txt). Storing the ID against our own node is the
-- one field a Merchant Center feed requires that /store/feed does not yet
-- emit — with it, Alkemart sellers become eligible for free Shopping listings
-- in Ghana. Nullable: an unmapped node simply omits the field.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS google_category_id integer;
