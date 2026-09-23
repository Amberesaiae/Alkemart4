-- 0030: append-only money ledger + canonical ISO-4217 currency storage.
-- Ledger: every money movement is a row written in the SAME transaction as
-- the state change it records (sale + platform_fee at confirm, payout at
-- settlement). Idempotency keys converge redelivered work via
-- INSERT ... ON CONFLICT DO NOTHING.
-- Currency: stored convention becomes ISO-4217 UPPERCASE (matches Paystack
-- and the domain Money type). The backfill is deterministic and re-runnable.
-- Entirely additive and re-runnable.

CREATE TABLE IF NOT EXISTS ledger_entries (
  id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  market_code text NOT NULL,
  seller_id text NOT NULL REFERENCES sellers (id),
  order_id text REFERENCES orders (id),
  intent_id text,
  kind text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_seller_idx ON ledger_entries (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_order_idx ON ledger_entries (order_id);

UPDATE carts SET currency = UPPER(currency) WHERE currency <> UPPER(currency);
UPDATE offers SET currency = UPPER(currency) WHERE currency <> UPPER(currency);
UPDATE order_groups SET currency = UPPER(currency) WHERE currency <> UPPER(currency);
UPDATE payment_intents SET currency = UPPER(currency) WHERE currency <> UPPER(currency);
