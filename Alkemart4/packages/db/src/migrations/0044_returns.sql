-- 0044: returns and disputes (pilot phase 3).
--
-- One case per seller order at a time. The buyer asks (reason + money back or
-- a replacement); the seller refunds, replaces or declines; a decline the
-- buyer disputes, or a seller who doesn't answer in time, goes to admin, who
-- refunds in full or sides with the seller.
-- Deadlines live on the case (respond_by); a sweep applies them. Refunds lower
-- what the seller is paid for the order (orders.refunded_pesewas). If the
-- order was already paid out, the seller's share is recovered from their next
-- payout (seller_recovery_pesewas → recovered_payout_id, payouts.recovered_pesewas).
-- The legacy, unused `returns` table from 0004 is left alone.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_pesewas bigint NOT NULL DEFAULT 0;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS recovered_pesewas bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS return_cases (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  seller_id text NOT NULL REFERENCES sellers(id),
  buyer_email text NOT NULL,
  reason text NOT NULL,
  wish text NOT NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  respond_by timestamptz,
  decline_reason text,
  outcome text,
  refund_pesewas bigint NOT NULL DEFAULT 0,
  refund_via text,
  refund_status text,
  refund_ref text,
  seller_recovery_pesewas bigint NOT NULL DEFAULT 0,
  recovered_payout_id text,
  admin_note text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS return_cases_one_open_uidx ON return_cases (order_id) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS return_cases_seller_status_idx ON return_cases (seller_id, status);
CREATE INDEX IF NOT EXISTS return_cases_due_idx ON return_cases (respond_by) WHERE status <> 'closed';

DO $$ BEGIN
  ALTER TABLE return_cases ADD CONSTRAINT return_cases_status_ck
    CHECK (status IN ('requested', 'declined', 'escalated', 'closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE return_cases ADD CONSTRAINT return_cases_reason_ck
    CHECK (reason IN ('damaged', 'wrong_item', 'not_as_described', 'changed_mind'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE return_cases ADD CONSTRAINT return_cases_wish_ck CHECK (wish IN ('refund', 'swap'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE return_cases ADD CONSTRAINT return_cases_refund_status_ck
    CHECK (refund_status IS NULL OR refund_status IN ('pending', 'paid', 'failed', 'owed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE return_cases ADD CONSTRAINT return_cases_amounts_ck
    CHECK (refund_pesewas >= 0 AND seller_recovery_pesewas >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
