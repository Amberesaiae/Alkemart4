# Agnostic production plan — multivendor marketplace kernel

**Status:** Canonical build plan (derives from `AGNOSTIC-APPROACH.md`, `ACID-DATAFLOW.md`)
**Rule:** every phase is independently shippable, deletes more than it adds where
possible, and carries its own tests. No phase may hardcode currency, market,
PSP, region, or infrastructure vendor into the domain kernel.

## 0. First principles (constraints → derivations)

| # | Constraint (fact) | Derivation (what we must do) |
|---|---|---|
| C1 | Users are in Ghana on slow mobile; DB is in Ireland (eu-west-1) | Minimize API→DB round trips per request; cache at the edge; never N+1 across regions |
| C2 | Workers Free: 5 cron triggers/account (code 10072, verified live) | Async work must not depend on cron; use Queues (10k ops/day free, same limits Free/Paid per docs 2026-04-21) |
| C3 | Queues = at-least-once delivery (verified: delivery-guarantees doc) | Every consumer must be idempotent; every message carries an idempotency key used as DB PK or dedup key |
| C4 | `ACID-DATAFLOW.md:31` — per-request postgres clients; Workers forbids cross-request socket reuse | Delete connection-sharing cleverness; per-request clients over Hyperdrive (docs-blessed), small pool locally |
| C5 | Multivendor = sellers must be structurally isolated | RLS `RESTRICTIVE` policies + `FORCE` + `SET ROLE` tests; app scoping alone is one forgotten `WHERE` from a leak |
| C6 | Money disputes are settled with rows, not code | Append-only ledger; every movement references order/intent rows; pesewas integers (existing invariant) |
| C7 | Ghana is the first market, not the only one (`markets` table exists) | Currency/locale/PSP resolve from `market_code` → config tables; `"ghs"` string literals are bugs, not defaults |
| C8 | Tests run 45 files capped at 2 workers; InMemory repos exist | Keep pure domain functions (`*From(snapshot, …)`) testable without DB; DB-touching paths tested against real Postgres where feasible |

## 1. Agnostic rules (no hardcodes — enforced in review)

1. **Currency:** `Money = { amount_minor: bigint, currency: ISO-4217 }`. No `currency`
   literal in domain logic; write paths resolve currency from the market row.
   Display formatting lives in `@alkemart/shared` per currency code, never
   `₵`-literal in components.
2. **Market/location:** geography, MoMo providers, address shapes resolve from
   `market_code` (default from env `DEFAULT_MARKET_CODE`, never a country literal
   in code). `@alkemart/shared/ghana` becomes `markets/gh` data, not branches.
3. **PSP:** domain defines a `ChargePort`/`TransferPort` interface
   (`initiateCharge`, `verifyCharge`, `createTransfer`, `verifyWebhook`);
   `packages/paystack` is one adapter. Webhook route authenticates per-adapter.
4. **Jobs:** domain defines job contracts (`ExpireIntents`, `DispatchNotifications`,
   `SettlePayout`) as typed messages with idempotency keys; Cloudflare Queues is
   the adapter (producer binding + consumer handler). A second adapter (Railway
   cron → HTTP, local inline runner for tests) must be expressible without
   touching domain code.
5. **Infra names:** queue names, binding names, index names, cron schedules live
   in one config module per app (`apps/api/src/config.ts`), read from env with
   validated defaults — never string literals scattered in handlers.
6. **Migrations:** idempotent raw SQL (`IF NOT EXISTS`), lexicographic order,
   applied exactly once per environment; schema mirrors in `packages/db` in the
   same commit.

## 2. Verified source base (fetched 2026-09-23; search engine was down, docs direct)

- Queues get-started / limits / pricing / batching-retries / local-dev /
  delivery-guarantees (`developers.cloudflare.com/queues/…`, updated 2026-04-21)
- PostgreSQL 18 §5.9 Row Security Policies + F.35 pg_trgm (`postgresql.org/docs/current/`)
- Repo doctrine: `AGNOSTIC-APPROACH.md`, `AGENT-PLAYBOOK.md`, `ACID-DATAFLOW.md`, `LOCAL-DEV.md`
- Local tool truth: `drizzle-kit v0.31.10` (`check` validates config only —
  NOT schema↔journal drift; journal ends at 0017 while DB is at 0028)

## 3. Phases

### Phase 1 — Single-query catalog (latency; closes the perf thread)
**Delete:** full-snapshot `load()` for listings, singleflight, most of edge-cache;
**revert** per-request client sharing (violates C4).
**Build:** `listCatalogSlice(db, q)` =
1× `products WHERE status='published' [AND category IN (subtree via RECURSIVE CTE)]
ORDER BY created_at DESC LIMIT/OFFSET` (uses `products_status_created_idx`) +
1× `offers WHERE product_id IN (…) AND active` + 1× `variants WHERE product_id IN (…)`
(uses 0028 indexes) + dimension slices (sellers/categories by id; KV-cached, small).
Feed the existing pure `listCatalogFrom`/`cardsFor` with the minimal slice.
**Accept:** p95 cold catalog < 1.5s local-derated; `/store/catalog` contract unchanged
(OpenAPI + `product-urls` tests green); snapshot `load()` retained only for admin
taxonomy board until its own slice lands.
**Verify:** `test:api`, `test:domain`, storefront suite, live timing runs ×3.
**Docs:** `LIFECYCLE-BUYER.md` (listing path), `ACID-DATAFLOW.md` §read amplification.

### Phase 2 — Queues for expiry + notifications (reliability; ends the cron fight)
**Queues:** `alkemart-jobs-intent-expiry` (+DLQ), `alkemart-jobs-notifications` (+DLQ);
consumer `max_batch_size=100`, `max_retries=3` default, per-message `ack()` after
idempotent DB commit, `retry({delaySeconds: backoff(attempts)})` on transient
(Paystack 429/5xx); `delaySeconds` up to 24h for scheduled sweeps.
**Producers:** checkout/webhook handlers `send()` typed domain messages
(`{kind, idempotencyKey, …}`); hourly sweep keeps ONE trigger publishing a single
`sweep` message (or Railway cron → existing `POST /admin/migrate/expire-payment-intents`
fallback per ACID-DATAFLOW:30 — adapter, not new endpoint).
**Local:** `wrangler dev` emulates queues (verified docs); tests use inline runner
against InMemory repos (no network).
**Accept:** kill -9 mid-batch → redelivery converges with zero double-moves (CAS +
idempotency keys); DLQ receives poison messages; 0 cron slots required for jobs.
**Verify:** new `queues.test.ts` (at-least-once convergence, DLQ routing),
existing checkout replay tests.
**Docs:** `LIFECYCLE-PAYMENT.md`, `ACID-DATAFLOW.md` (replace cron row).

### Phase 3 — RLS tenant isolation (security; biggest gap)
Migration 0029: `ENABLE + FORCE ROW LEVEL SECURITY` on
`offers`, `orders`, `order_items`, `payouts`, `payout_lines`, `products`
(seller-owned rows); `RESTRICTIVE` policies on direct row equality
(`seller_id = current_setting('app.seller_id', true)`); permissive
`SELECT USING (true)` storefront read policy via read role; admin via elevated
connection. Connection setup runs `SET LOCAL app.seller_id` per request scope.
**Accept:** `SET ROLE` tests prove seller A sees zero seller-B rows on all six
tables; owner-bypass closed by `FORCE`; backup/export paths use
`row_security=off`-safe superuser reads (per PG docs caution).
**Verify:** `rls.test.ts` (allow + deny matrix), full suites.
**Docs:** new `docs/architecture/workers/TENANT-ISOLATION.md` + `LIFECYCLE-VENDOR.md`.

### Phase 4 — Ledger + currency/market-agnostic money (correctness)
`ledger_entries(idempotency_key PK, seller_id, order_id, intent_id, kind, amount_minor,
currency, balance_after, market_code, created_at)`; every money move writes a row
inside the same tx (payout lines reference ledger rows; webhook confirm writes
`sale`+`platform_fee` rows). Domain `Money` type; `commission_bps` resolves from
market config; remove `"ghs"` literals from write paths (resolve via market row).
**Accept:** seller dispute answerable by `SELECT` over ledger; multi-currency
insert path tested (e.g. `GHS` + `USD` rows coexist, formatting per code).
**Verify:** `ledger.test.ts` (double-entry balance, idempotent replay),
`money.test.ts` (multi-currency), existing payout/checkout suites.
**Docs:** `LIFECYCLE-PAYMENT.md`, commercial spine reference.

### Phase 5 — pg_trgm search (relevance without new infra)
Migration: `CREATE EXTENSION pg_trgm` (trusted, non-superuser installable per
docs) + `GIN (title gin_trgm_ops)` (+ description) indexes; query
`WHERE title % q ORDER BY title <-> q LIMIT n`, threshold via
`pg_trgm.similarity_threshold` from config (default 0.3), seller scoping preserved.
**Accept:** typo queries (`"samsumg"`, `"sandal"`) return ranked results < 200ms
on pilot data; relevance tests pin ordering.
**Verify:** `search-trgm.test.ts`, existing search tests.
**Docs:** `LIFECYCLE-BUYER.md` (search path).

### Phase 6 — Migration discipline (hygiene; unblocks CI)
Owned idempotent runner (`bun run db:migrate` → `scripts/apply-migrations.ts`,
pure planner in `packages/db/src/migration-plan.ts`): applies
`packages/db/src/migrations/*.sql` in order, tracking `schema_migrations` —
works on any Postgres, no journal. Complements the repo convention
(`scripts/check-migrations.ts`: journal frozen at 0017, gapless numbering,
idempotency guard — `drizzle-kit generate` stays forbidden). Author new
migrations as hand-written idempotent SQL; drizzle schema mirrors ship in the
same commit.
**Accept:** fresh empty DB → migrate → all suites pass; re-run is a no-op.
**Verify:** `bun run check:migrations`, planner unit tests, live no-op run.

## 4. Cross-phase rules
- Playbook Steps A–D every phase (classify lifecycle → backend first → frontend
  second → verify); update the matching lifecycle doc in the same commit.
- Test worker cap stays 2; pure functions keep snapshot-pure signatures so
  InMemory tests never need env.
- `VITE_ALKEMART_API_URL` discipline unchanged; no Medusa imports; stay on `main`.
- Deploy order per phase: migrate (idempotent, safe first) → deploy API → measure.
