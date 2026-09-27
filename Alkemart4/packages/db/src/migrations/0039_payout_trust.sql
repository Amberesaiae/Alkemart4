-- 0039: payouts you can trust + a Paystack event log.
--
-- Payouts were written as "paid" the moment Paystack accepted a transfer
-- request (Paystack answers "pending"; the result arrives later by
-- webhook), transfer.success/failed/reversed were ignored, and a failed
-- transfer kept its orders locked forever. Now: a payout is reserved first
-- (exact orders, one Paystack reference reused on every retry), then sent,
-- then settled by webhook or by verifying the reference. Every step is a
-- payout_events row sellers and admins can read, with the reason when a
-- transfer fails.
--
-- paystack_events records every signed webhook we receive (minimal fields,
-- no card or phone data) and what we did with it, so ops can reconcile and
-- see alerts: paid-after-expiry, amount mismatch, disputes, refunds.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'reversed';

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS created_by text;

CREATE TABLE IF NOT EXISTS payout_events (
  id text PRIMARY KEY,
  payout_id text NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  status text NOT NULL,            -- created | sent | paid | failed | reversed | checked | retried
  actor text NOT NULL,             -- admin:<id> | paystack | system
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_events_payout_idx ON payout_events (payout_id, created_at);

CREATE TABLE IF NOT EXISTS paystack_events (
  id text PRIMARY KEY,
  event text NOT NULL,
  reference text,
  amount_minor bigint,
  currency text,
  status text,
  outcome text NOT NULL,           -- confirmed | settled | ignored | duplicate | alert:<kind>
  detail text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paystack_events_received_idx ON paystack_events (received_at DESC);
CREATE INDEX IF NOT EXISTS paystack_events_reference_idx ON paystack_events (reference);

-- Trust badges were created as 'pending' and nothing ever verified them,
-- while the storefront showed every row (revoked ones too) as a badge. An
-- admin issuing a badge with evidence *is* the check, so issued badges are
-- 'verified' from now on, and the public endpoint shows only those. Carry
-- existing admin-issued, unrevoked badges over. Idempotent.
UPDATE seller_verifications SET status = 'verified'
WHERE status = 'pending' AND revoked_at IS NULL;
