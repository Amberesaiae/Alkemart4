-- 0038: listing review history + platform settings.
--
-- Moderation decisions carried no reason: a rejected or "changes requested"
-- listing told the seller nothing, and "changes requested" looked exactly
-- like "in review". Every step is now a row: who (seller submitted, system
-- rules, AI, admin), what, why (structured reasons the seller can act on),
-- and for AI the model and confidence — so admins can audit and override.
--
-- platform_settings holds operator switches (e.g. listing review mode:
-- manual | assist | auto) without a deploy.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS listing_reviews (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  decision text NOT NULL,          -- submitted | approve | reject | request_changes | escalate
  reviewer text NOT NULL,          -- seller | system | ai | admin
  reviewer_id text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{code, message, field?}]
  note text,
  model text,
  confidence real,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE listing_reviews ADD CONSTRAINT listing_reviews_decision_ck
    CHECK (decision IN ('submitted', 'approve', 'reject', 'request_changes', 'escalate'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE listing_reviews ADD CONSTRAINT listing_reviews_reviewer_ck
    CHECK (reviewer IN ('seller', 'system', 'ai', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS listing_reviews_product_idx ON listing_reviews (product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
