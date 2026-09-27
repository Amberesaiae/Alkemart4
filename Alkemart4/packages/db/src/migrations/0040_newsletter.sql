-- 0040: newsletter subscribers (double opt-in).
--
-- A footer signup creates a `pending` row and sends a signed confirm link;
-- only `confirmed` addresses are ever mailed. Unsubscribing keeps the row as
-- `unsubscribed` so a later import can't silently re-add the person.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz
);

DO $$ BEGIN
  ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_status_ck
    CHECK (status IN ('pending', 'confirmed', 'unsubscribed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
