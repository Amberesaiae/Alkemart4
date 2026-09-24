-- 0033: attribute scope — universal vs profile-scoped.
--
-- A `universal` attribute means the same thing in every category (colour,
-- material) and survives navigation. A `profile` attribute is only meaningful
-- where its profile declares it (ram_gb in Accessories is noise) and is dropped
-- on arrival. Making this a column rather than a hardcoded list of codes stops
-- the classification drifting away from the definitions it describes.
--
-- Idempotent per packages/db/src/migrations/README.md.

DO $$ BEGIN
  CREATE TYPE attribute_scope AS ENUM ('universal', 'profile');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE attribute_definitions
  ADD COLUMN IF NOT EXISTS scope attribute_scope NOT NULL DEFAULT 'profile';
