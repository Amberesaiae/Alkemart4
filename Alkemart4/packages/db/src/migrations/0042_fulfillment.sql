-- 0042: delivery options and the handover code.
--
-- Sellers price delivery by zone (same town / region / other regions) or let
-- the buyer collect. The buyer's choice and fee per seller are frozen on the
-- payment intent at checkout, then on each order. Delivery orders carry a
-- 4-digit handover code the buyer gives the rider. The code is optional:
-- sellers can always mark an order delivered. Buyer proof (the code, or the
-- buyer's own "I got it") releases an online payout at once; the seller's
-- word alone releases it after a short report window (payout_release_at).
-- Wrong code tries are counted and capped (anti-guessing).
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS fulfillment jsonb;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS handover_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS handover_failures integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_by text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_release_at timestamptz;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_delivery_confirmed_by_ck
    CHECK (delivery_confirmed_by IS NULL OR delivery_confirmed_by IN ('buyer_code', 'buyer', 'seller'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_ck
    CHECK (fulfillment_method IN ('delivery', 'pickup'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_delivery_zone_ck
    CHECK (delivery_zone IS NULL OR delivery_zone IN ('town', 'region', 'country'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
