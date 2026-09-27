-- 0048: ⚖ compare tokens and saved comparisons (MVP compare, step 1).
--
-- One wallet per buyer: the balance and when it was last topped up. The
-- grant and refill period live in the domain (DEFAULT_COMPARE_POLICY);
-- tokens are credits with no cash value. A comparison is saved when a token
-- is spent, so reopening or sharing it back to yourself costs nothing, and
-- the product ids feed seller price insight later (counts only, never who).
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS compare_wallets (
  user_id text PRIMARY KEY,
  balance integer NOT NULL CHECK (balance >= 0),
  refilled_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comparisons (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  product_ids text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comparisons_user_idx ON comparisons (user_id, created_at DESC);
