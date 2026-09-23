-- Blueprint Phase 5A — campaign engine entities (ADR-004).
-- Idempotent (IF NOT EXISTS / duplicate_object guards).

DO $$ BEGIN CREATE TYPE campaign_status AS ENUM('draft', 'review', 'scheduled', 'live', 'ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE campaign_objective AS ENUM('sale', 'launch', 'clearance', 'brand'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE campaign_event AS ENUM('view', 'select'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS placements (
  code text PRIMARY KEY,
  job text NOT NULL,
  max_live integer NOT NULL DEFAULT 1,
  constraints jsonb
);

CREATE TABLE IF NOT EXISTS promotion_terms (
  id text PRIMARY KEY,
  label text NOT NULL,
  summary text NOT NULL,
  fine_print text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  tracking_id text NOT NULL UNIQUE,
  objective campaign_objective NOT NULL DEFAULT 'sale',
  placement_code text NOT NULL REFERENCES placements(code),
  status campaign_status NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 0,
  sponsored integer NOT NULL DEFAULT 0,
  frequency_cap integer,
  terms_id text REFERENCES promotion_terms(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_placement_status_idx ON campaigns (placement_code, status);

CREATE TABLE IF NOT EXISTS creatives (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  slot text NOT NULL DEFAULT 'desktop',
  title text NOT NULL,
  subtitle text,
  image_url text,
  link text,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_sets (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS product_set_items (
  id text PRIMARY KEY,
  set_id text NOT NULL REFERENCES product_sets(id),
  product_id text NOT NULL REFERENCES products(id),
  position integer NOT NULL DEFAULT 0,
  UNIQUE (set_id, product_id)
);

CREATE TABLE IF NOT EXISTS seller_sets (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS seller_set_items (
  id text PRIMARY KEY,
  set_id text NOT NULL REFERENCES seller_sets(id),
  seller_id text NOT NULL REFERENCES sellers(id),
  position integer NOT NULL DEFAULT 0,
  UNIQUE (set_id, seller_id)
);

CREATE TABLE IF NOT EXISTS campaign_audit (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  actor text,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_audit_campaign_idx ON campaign_audit (campaign_id, created_at);

CREATE TABLE IF NOT EXISTS campaign_events (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  placement_code text NOT NULL,
  creative_id text,
  position integer,
  event campaign_event NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_idx ON campaign_events (campaign_id, event, created_at);

-- Fixed inventory slots (Phase 5A): the page has N slots, seeded once.
INSERT INTO placements (code, job, max_live, constraints) VALUES
  ('hero', 'Homepage hero', 1, '{"minProducts": 1, "requiresImage": true}'),
  ('deal_rail', 'Deal rail', 1, '{"minProducts": 2}'),
  ('promo_grid', 'Promo grid', 2, '{"minProducts": 2}'),
  ('promo_band', 'Promo band', 1, '{"minProducts": 1}'),
  ('marquee', 'Marquee strip', 1, '{"minProducts": 0}')
ON CONFLICT (code) DO NOTHING;
