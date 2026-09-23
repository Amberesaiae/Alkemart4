-- Blueprint Phase 3A/3D — verification evidence + price history.
-- Idempotent (IF NOT EXISTS / duplicate_object guards).

DO $$ BEGIN CREATE TYPE verification_kind AS ENUM('contact', 'identity', 'business', 'brand_auth', 'fulfillment_proven'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM('pending', 'verified', 'revoked', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS seller_verifications (
  id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES sellers(id),
  kind verification_kind NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending',
  evidence text,
  issued_by text,
  issued_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_verifications_seller_idx ON seller_verifications (seller_id, status);

CREATE TABLE IF NOT EXISTS offer_price_history (
  id text PRIMARY KEY,
  offer_id text NOT NULL REFERENCES offers(id),
  old_price_pesewas bigint NOT NULL,
  new_price_pesewas bigint NOT NULL,
  changed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offer_price_history_offer_idx ON offer_price_history (offer_id, created_at);
