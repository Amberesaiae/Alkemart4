-- Blueprint Phase 4D — payout holds with reasons.
-- Idempotent (IF NOT EXISTS / duplicate_object guards).

DO $$ BEGIN CREATE TYPE payout_hold_status AS ENUM('held', 'released'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payout_holds (
  id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES sellers(id),
  order_id text REFERENCES orders(id),
  amount_pesewas bigint,
  reason text NOT NULL,
  status payout_hold_status NOT NULL DEFAULT 'held',
  created_by text,
  released_by text,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_holds_seller_idx ON payout_holds (seller_id, status);

-- Blueprint Phase 4E — bulk import batches (idempotency ledger).
CREATE TABLE IF NOT EXISTS vendor_imports (
  id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES sellers(id),
  import_key text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  success integer NOT NULL DEFAULT 0,
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, import_key)
);
