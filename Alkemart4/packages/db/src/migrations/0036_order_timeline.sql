-- 0036: order timeline + frozen delivery promise.
--
-- Orders had no clock: only a status. Buyers could not see when their order
-- was sent, sellers could not see how long an order had waited, and nobody
-- could say whether a delivery was late.
--
-- 1. order_events — append-only history of every status change (who, when).
--    Never updated or deleted; the order's current `status` stays the source
--    of truth for transitions, the events are the audit trail and timeline.
-- 2. Promise columns on orders — computed once at checkout from the seller's
--    delivery settings and frozen, so editing settings never rewrites a
--    promise already made to a buyer.
--
-- Idempotent per packages/db/src/migrations/README.md. All new columns are
-- nullable: legacy orders simply show no promise.

CREATE TABLE IF NOT EXISTS order_events (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  status order_status NOT NULL,
  actor text NOT NULL,              -- 'buyer' | 'seller' | 'admin' | 'system'
  actor_id text,
  note text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, at);

-- One event per status per order: retries and double taps can't duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS order_events_order_status_uq ON order_events (order_id, status);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dispatch_by timestamptz,
  ADD COLUMN IF NOT EXISTS deliver_earliest timestamptz,
  ADD COLUMN IF NOT EXISTS deliver_latest timestamptz;

-- Backfill a 'placed' event for existing orders from their group's clock.
INSERT INTO order_events (id, order_id, status, actor, at)
SELECT 'backfill-' || o.id, o.id, 'placed', 'system', g.created_at
FROM orders o JOIN order_groups g ON g.id = o.order_group_id
ON CONFLICT DO NOTHING;
