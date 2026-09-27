-- 0043: frozen monthly statements.
--
-- One row per (scope, seller, month) once the month has ended: the statement
-- data exactly as it was built, plus a SHA-256 of its canonical JSON so anyone
-- can prove it wasn't edited. Rows are never updated; corrections appear as
-- lines in a later month. seller_id is '' for the platform statement so the
-- unique key works without NULL tricks.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS statements (
  id text PRIMARY KEY,
  scope text NOT NULL,
  seller_id text NOT NULL DEFAULT '',
  period text NOT NULL,
  data jsonb NOT NULL,
  hash text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS statements_scope_seller_period_uidx ON statements (scope, seller_id, period);

DO $$ BEGIN
  ALTER TABLE statements ADD CONSTRAINT statements_scope_ck CHECK (scope IN ('seller', 'platform'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE statements ADD CONSTRAINT statements_period_ck CHECK (period ~ '^[0-9]{4}-[0-9]{2}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
