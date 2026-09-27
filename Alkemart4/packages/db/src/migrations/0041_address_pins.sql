-- 0041: exact delivery spot on saved buyer addresses.
--
-- Buyers can drop a pin at checkout so riders find the gate, not just the
-- area. Saving it on the address book entry means a repeat buyer never pins
-- twice. Both columns are null together (no pin) or set together.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE buyer_addresses ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE buyer_addresses ADD COLUMN IF NOT EXISTS longitude double precision;

DO $$ BEGIN
  ALTER TABLE buyer_addresses ADD CONSTRAINT buyer_addresses_pin_ck
    CHECK ((latitude IS NULL) = (longitude IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
