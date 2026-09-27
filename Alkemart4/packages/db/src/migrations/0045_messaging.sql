-- 0045: messaging and product Q&A (pilot phase 4).
--
-- One thread per buyer + seller + subject (a product, an order, or general).
-- Messages carry contact flags (phone / email / paying outside) so both sides
-- get a "pay only through alkemart" warning; they are never blocked for it.
-- Either side can report or block a thread; admin reads only reported ones.
-- Product questions are public once answered; admin can hide one.
--
-- Idempotent per packages/db/src/migrations/README.md.

CREATE TABLE IF NOT EXISTS message_threads (
  id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES sellers(id),
  buyer_user_id text NOT NULL,
  buyer_email text NOT NULL,
  buyer_name text,
  subject text NOT NULL,
  product_id text,
  order_id text,
  buyer_read_at timestamptz,
  seller_read_at timestamptz,
  blocked_by text,
  reported_by text,
  report_reason text,
  reported_at timestamptz,
  report_resolved_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_threads_subject_uidx ON message_threads (seller_id, buyer_user_id, subject);
CREATE INDEX IF NOT EXISTS message_threads_buyer_idx ON message_threads (buyer_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS message_threads_seller_idx ON message_threads (seller_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS message_threads_reported_idx ON message_threads (reported_at) WHERE reported_at IS NOT NULL AND report_resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender text NOT NULL,
  body text NOT NULL,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS product_questions (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  seller_id text NOT NULL REFERENCES sellers(id),
  asker_user_id text NOT NULL,
  asker_name text,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_questions_product_idx ON product_questions (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_questions_seller_idx ON product_questions (seller_id, answered_at);

DO $$ BEGIN
  ALTER TABLE message_threads ADD CONSTRAINT message_threads_blocked_by_ck CHECK (blocked_by IS NULL OR blocked_by IN ('buyer', 'seller', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT messages_sender_ck CHECK (sender IN ('buyer', 'seller'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
