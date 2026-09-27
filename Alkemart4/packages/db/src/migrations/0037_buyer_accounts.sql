-- 0037: buyer accounts — profile, saved addresses, password reset.
--
-- Buyers could register and sign in, but nothing else: no name or phone on
-- the account, no address book (every checkout retyped the address), and a
-- forgotten password was unrecoverable.
--
-- Security notes:
--  * Reset tokens are stored as SHA-256 hashes only; the raw token exists in
--    the emailed link and nowhere else. Single use, 1 hour expiry.
--  * password_changed_at lets sensitive endpoints refuse sessions issued
--    before the last password change.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS buyer_addresses (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text,                          -- 'Home', 'Work', …
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  address_1 text NOT NULL,
  address_2 text,
  city text NOT NULL,
  province text,
  postal_code text,
  country_code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buyer_addresses_user_idx ON buyer_addresses (user_id);
-- At most one default address per buyer.
CREATE UNIQUE INDEX IF NOT EXISTS buyer_addresses_one_default ON buyer_addresses (user_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
