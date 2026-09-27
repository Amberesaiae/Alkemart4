-- 0049: no commission for the pilot (owner, 2026-09-27).
--
-- Sellers keep the full price; alkemart's pilot business model is seller
-- plans (paid tiers for reach), not a cut of each sale. The per-seller rate
-- stays, so admin can set one again later. Past payouts keep the rate they
-- were paid under (payout lines are frozen); only future payouts change.
--
-- Idempotent per packages/db/src/migrations/README.md.

ALTER TABLE sellers ALTER COLUMN commission_bps SET DEFAULT 0;
UPDATE sellers SET commission_bps = 0 WHERE commission_bps <> 0;
