-- 0029: RLS tenant isolation for seller-owned tables.
-- Multivendor first principle: one forgotten app-level WHERE must never leak
-- seller B's money rows to seller A. These policies fail closed (default-deny
-- when enabled with no other grant path) and compare a single row column —
-- the best-performing RLS shape per the Postgres docs (no sub-SELECTs, so no
-- documented race hazards).
--
-- Enforcement model: policies apply TO the dedicated `seller_api` role only.
-- Platform/storefront/admin paths keep using the owner connection (unaffected:
-- no PUBLIC policies exist, and role-scoped policies don't apply to the
-- owner). Vendor-scoped request paths SET ROLE seller_api + SET app.seller_id
-- (see TENANT-ISOLATION.md rollout). WITH CHECK defaults to the USING clause,
-- so writes are fenced identically to reads.
-- Entirely additive and re-runnable.

DO $$ BEGIN
  CREATE ROLE seller_api;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The deploying login (direct or pooler user) must be a MEMBER of seller_api
-- or SET ROLE fails with "permission denied". Dynamic: no login hardcoded.
DO $$ BEGIN
  EXECUTE format('GRANT seller_api TO %I', current_user);
END $$;

GRANT USAGE ON SCHEMA public TO seller_api;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON offers, orders, order_items, payouts, payout_holds
  TO seller_api;

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_isolation ON offers;
CREATE POLICY seller_isolation ON offers TO seller_api
  USING (seller_id = current_setting('app.seller_id', true));

DROP POLICY IF EXISTS seller_isolation ON orders;
CREATE POLICY seller_isolation ON orders TO seller_api
  USING (seller_id = current_setting('app.seller_id', true));

DROP POLICY IF EXISTS seller_isolation ON order_items;
CREATE POLICY seller_isolation ON order_items TO seller_api
  USING (seller_id = current_setting('app.seller_id', true));

DROP POLICY IF EXISTS seller_isolation ON payouts;
CREATE POLICY seller_isolation ON payouts TO seller_api
  USING (seller_id = current_setting('app.seller_id', true));

DROP POLICY IF EXISTS seller_isolation ON payout_holds;
CREATE POLICY seller_isolation ON payout_holds TO seller_api
  USING (seller_id = current_setting('app.seller_id', true));
