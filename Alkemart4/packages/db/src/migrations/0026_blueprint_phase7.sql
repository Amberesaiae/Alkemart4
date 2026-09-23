-- Blueprint Phase 7 — lifecycle growth foundations.
-- Idempotent (IF NOT EXISTS / duplicate_object guards).

-- 7A: permission center. Owner is a buyer email or a seller id; topic
-- scopes dashboard task categories for sellers (NULL = whole category).
CREATE TABLE IF NOT EXISTS notification_preferences (
  id text PRIMARY KEY,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  category text NOT NULL,
  topic text,
  opted_in integer NOT NULL DEFAULT 1,
  frequency_cap integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- NULL topics still collide: one row per owner/channel/category/topic.
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_owner_uidx
  ON notification_preferences (owner_type, owner_id, channel, category, (COALESCE(topic, '')));
CREATE INDEX IF NOT EXISTS notification_preferences_owner_idx
  ON notification_preferences (owner_type, owner_id);

-- Send-log category for frequency honesty (default keeps old rows valid).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional';

-- 7B: stock/price alert subscriptions. Contact always comes from the
-- authenticated buyer session — never from a request body — so the
-- endpoint cannot be used as a spam cannon. One-shot: firing deletes.
CREATE TABLE IF NOT EXISTS stock_subscriptions (
  id text PRIMARY KEY,
  buyer_email text NOT NULL,
  product_id text NOT NULL REFERENCES products(id),
  offer_id text REFERENCES offers(id),
  kind text NOT NULL,
  below_pesewas bigint,
  channel text NOT NULL DEFAULT 'sms',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_subscriptions_offer_idx ON stock_subscriptions (offer_id);

-- 7D: experiment registry with holdouts. Buckets assign deterministically
-- from (experiment, unit); exposure is logged for reporting.
DO $$ BEGIN CREATE TYPE experiment_status AS ENUM('draft', 'running', 'paused', 'ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS experiments (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status experiment_status NOT NULL DEFAULT 'draft',
  control_pct integer NOT NULL DEFAULT 50,
  primary_metric text,
  guardrails jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_exposures (
  id text PRIMARY KEY,
  experiment_id text NOT NULL REFERENCES experiments(id),
  unit_id text NOT NULL,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, unit_id)
);
CREATE INDEX IF NOT EXISTS experiment_exposures_exp_idx ON experiment_exposures (experiment_id, bucket);
