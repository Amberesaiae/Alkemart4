-- 0046: make an offer (pilot phase 5).
--
-- offer_negotiation: a seller marks one listing (offer) negotiable, with an
-- optional hidden floor. price_offers: one buyer's offer on one listing for a
-- quantity; the seller accepts, counters or declines; an accepted price is
-- usable by that buyer, for that listing and quantity, until valid_until.
-- payment_intents.deals freezes the deal prices used at checkout (per offer),
-- exactly like fulfillment choices, so the order total never drifts.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS offer_negotiation (
  offer_id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES sellers(id),
  negotiable boolean NOT NULL DEFAULT false,
  floor_pesewas bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_offers (
  id text PRIMARY KEY,
  offer_id text NOT NULL,
  product_id text NOT NULL,
  seller_id text NOT NULL REFERENCES sellers(id),
  buyer_user_id text NOT NULL,
  buyer_name text,
  qty integer NOT NULL DEFAULT 1,
  list_price_pesewas bigint NOT NULL,
  amount_pesewas bigint NOT NULL,
  counter_pesewas bigint,
  agreed_pesewas bigint,
  status text NOT NULL DEFAULT 'pending',
  respond_by timestamptz,
  valid_until timestamptz,
  used_intent_id text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_offers_buyer_idx ON price_offers (buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS price_offers_seller_idx ON price_offers (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS price_offers_due_idx ON price_offers (respond_by) WHERE status IN ('pending', 'countered');

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS deals jsonb;

DO $$ BEGIN
  ALTER TABLE price_offers ADD CONSTRAINT price_offers_status_ck
    CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'expired', 'used', 'withdrawn'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE price_offers ADD CONSTRAINT price_offers_amounts_ck CHECK (amount_pesewas > 0 AND qty > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
