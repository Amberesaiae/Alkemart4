-- Blueprint Phase 2A/2C/2D — search outbox, alias governance, query telemetry.
-- Idempotent (IF NOT EXISTS / duplicate_object guards).

DO $$ BEGIN CREATE TYPE outbox_status AS ENUM('pending', 'claimed', 'acked', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE alias_type AS ENUM('synonym', 'redirect'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE alias_status AS ENUM('proposed', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS search_outbox (
  id text PRIMARY KEY,
  entity text NOT NULL,
  entity_id text NOT NULL,
  op text NOT NULL,
  payload jsonb,
  status outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS search_outbox_status_idx ON search_outbox (status, created_at);

CREATE TABLE IF NOT EXISTS search_aliases (
  id text PRIMARY KEY,
  term text NOT NULL,
  target text NOT NULL,
  type alias_type NOT NULL,
  status alias_status NOT NULL DEFAULT 'proposed',
  reviewer_id text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_aliases_term_idx ON search_aliases (term, status);

CREATE TABLE IF NOT EXISTS search_query_log (
  id text PRIMARY KEY,
  query text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_query_log_created_idx ON search_query_log (created_at);
