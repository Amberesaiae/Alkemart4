> **Latest:** read `HANDOFF-CLAUDE-2026-09-28.md` first — active domains, production WorkOS configuration, undeployed security fixes, and ordered release gates. Older audit history: `HANDOFF-AUDIT-2026-09-27.md`.

# Handoff — where the pilot build stands (2026-09-27)

**Release update:** the owner subsequently authorized the deployment workflow.
A full schema-and-data backup was verified and migrations 0036–0049 were
applied with the repository runner. Live history now contains all 50 files,
with none pending. See `RELEASE-2026-09-27.md` for evidence and remaining
payment verification. API and all three v2 Pages apps are deployed, with
production origins and the old storefront cache retired. Live reporting
timestamp failures found during verification were fixed and redeployed.
Statements below describing these migrations as
unapplied refer to the earlier handoff state.

For whoever continues (Codex or a person). Read with `PILOT-PLAN.md`,
`BUILD-LOG.md` §17–21 and the tail of the build log, `ESCROW-OPTIONS.md`, and
the lifecycle docs. Rules for building: `.claude/skills/alkemart-feature-build`,
`alkemart-ui-ux`, `alkemart-sandbox-verify` (plain markdown, readable by any
tool).

## What ships, and what to ignore

Deploy **only** these:

| Part | Folder | Where |
|---|---|---|
| API | `apps/api` | Cloudflare Worker (`bun run deploy:api`) |
| Storefront | `apps/storefront-v2` | Pages `alkemart4-storefront` |
| Seller app | `apps/vendor-v2` | Pages `alkemart4-vendor` |
| Admin | `apps/admin-v2` | Pages `alkemart4-admin` |

`scripts/deploy-pages.sh` and the root `build` script now build the v2 apps.
All three v2 apps build for production (`vite build`, checked 2026-09-27) and
ship `public/_redirects`.

**Retired — do not edit, build, test against, or deploy:**
- `apps/storefront`, `apps/backend/**` (old storefront, `ghana-vendor`, old admin).
- `archive/**`, anything Medusa / Mercur / Railway / Neon.
- Old approaches the pilot replaced: admin approval gates (trust by default
  instead), native date inputs, pop-up flows (inline instead), region
  dropdowns (map pins instead), commission as the business model (0% now;
  seller plans next), admin-tunable return numbers (fixed domain defaults).

**Built but switched off for the first deploy (keep the code, don't delete):**
| Feature | Switch |
|---|---|
| ⚖ Compare (mode, page, homepage showcase, "From · N sellers", seller sort, "Best price" badges) | `COMPARE_ENABLED` in `apps/storefront-v2/src/lib/features.ts`; API `/store/compare` unmounted in `apps/api/src/index.ts`; search shows "Compare — coming soon" |
| Automatic payouts | `DEFAULT_PAYOUT_POLICY.autoPayout` in `packages/domain/src/payout-state.ts` |
| Make an offer | `DEALS_ENABLED` in `apps/api/src/lib/deals.ts`, routes unmounted |
| Faster listing / videos (phase 6) | routes unmounted, `PHOTO_READING_ENABLED = false` |

Their tests are `describe.skip` until switched on.

**Local dev:** use the v2 apps instead (`bun run dev` inside each `apps/*-v2`, or the sandbox configs below). `scripts/dev-workers.sh` starts the v2 apps.

## Ground rules (owner)

- **Nothing is committed.** Stay on `main`; commit or push only when the owner asks.
- **Do not apply migrations to the live database.** 0036–0049 are unapplied;
  the owner applies them.
- Never print or paste keys. The sandbox uses a fake Paystack.
- Build the canonical, market-standard flow the owner asked for; propose any
  extra state/option/rule in one line and wait for a yes.
- Rules live in `packages/domain`; the API computes; apps only display. Money
  in minor units from the market config, never a hard-coded 100 or "GH₵".
- API tests: `cd apps/api && npx vitest run --maxWorkers=2` (never uncap).
  Files that time out (>5s) under a full run usually pass alone.
- Type checks: apps `NODE_OPTIONS=--max-old-space-size=3072 npx tsc -b --noEmit`;
  API `npx tsc --noEmit -p .`. Migrations: `bun scripts/check-migrations.ts`.

## Sandbox (prove every change here)

- API: `bun apps/api/scripts/sandbox.ts` (port 8788, in memory; restart after
  API changes). Sessions print as `SELLER_SESSION` / `BUYER_SESSION` /
  `ADMIN_SESSION` JSON; put them in localStorage (`alkemart_session` for the
  storefront, `alkemart_admin_session` for admin).
- UIs (`.claude/launch.json`): sandbox-storefront 5176, sandbox-vendor 3004,
  sandbox-admin 3003.
- `POST /__sandbox/clock {"hours":N}` moves the clock (report windows,
  deadlines). Fake Paystack: card initialise, MoMo charge/verify, refunds,
  transfers (return "pending"; admin **Check** settles them).
- Catalogue: Tecno Spark (2 shops) and itel A70 (1 shop) — search "a".

## Done in this stretch (uncommitted, verified)

| Area | State |
|---|---|
| Returns simplified | seller refund / replace / decline; buyer accept / escalate / "it's sorted"; admin full refund or side with seller; only deadline = seller 48h → admin; refund on a paid-out order comes off the next payout. Fixed domain defaults. |
| Pay everyone ready | admin → Payouts, `POST /admin/payouts/run`; test in `routes/admin/payouts.test.ts`; proven in sandbox. |
| Automatic payouts | built, **off** (`DEFAULT_PAYOUT_POLICY.autoPayout = false` in `packages/domain/src/payout-state.ts`); shared path `apps/api/src/lib/payouts.ts`; queue job `auto-payout` in `jobs.ts`; test `auto-payout.test.ts` skipped. See `ESCROW-OPTIONS.md`. |
| No commission | Ghana `defaultCommissionBps: 0` (`packages/shared/src/markets.ts`), migration `0049_no_commission.sql`, demo shops 0, seller Money page hides commission at 0%. |
| ⚖ Compare step 1 (switched off, "coming soon") | migration `0048_compare.sql`; domain `compare.ts`; API `routes/store/compare.ts` + `compare-store.ts`; storefront Compare switch on search, pick buttons, floating bar, `/compare/$id`; tests `compare.test.ts` (API + domain); proven desktop + 375px. |
| Docs | PILOT-PLAN, BUILD-LOG, LIFECYCLE-PAYMENT/VENDOR updated; `ESCROW-OPTIONS.md` new. |

Last checks (2026-09-27, after Compare was switched off): API suite **341
passed, 11 skipped** (Compare, automatic payouts, deals); domain **176
passed**; type checks and eslint clean in the API and all three v2 apps;
`vite build` succeeds for all three; the Drizzle schema matches migrations
0036–0049 column for column.

**Not yet proven:** the Postgres code behind 0036–0049 (returns, messaging,
payout holds, statements, timeline…) has only run against the in-memory
store. Its first real run must be the rehearsal in step 5, before sellers are
invited.

## Remaining work, in order

### 1. Re-verify — done 2026-09-27 (repeat after any change)
- Full API suite (`--maxWorkers=2`); re-run any failing file alone.
- `npx eslint src` in storefront-v2, vendor-v2, admin-v2; domain tests
  (`cd packages/domain && npx vitest run`).

### 2. Compare — off for the first deploy; known gaps for when it's back
- The "delivered price" uses each offer's flat `deliveryFeePesewas`, not the
  buyer's zone price (phase-1 zone fees). Fine for the pilot; for accuracy,
  price delivery with the buyer's saved location like checkout does.
- The storefront falls back to 4 as the pick limit before sign-in
  (`src/lib/compare-picker.ts`); the API enforces the real limit.
- The card line "From GH₵… · N sellers" is hidden with Compare (cards now show
  the best offer's price "by {shop}"). When Compare returns, ask the owner:
  "sellers" or "shops".
- Next Compare steps (only after owner says go): price-drop alerts (1 token),
  seller price insight (paid), token packs (only if the pilot shows need).

### 3. Seller plans — the business model (needs owner decisions first)
Jiji-style paid tiers instead of commission. Proposed, not built:
- Free tier: list and sell (a listing limit).
- Paid tiers: more listings, **"Promoted"** spots at the top of search and
  categories (always labelled), homepage rotation, a tier badge; monthly or
  yearly.
- Fairness: paying never changes "Best price" or Compare results.
- Pilot payment: seller pays by MoMo to alkemart; admin marks the plan
  "active until" a date (no automatic billing yet).
- **Owner decides:** number and names of tiers, prices (monthly/yearly), perks
  per tier (listing limit, promoted slots, badge).
- Build as: domain `plans.ts` (tiers, perks, per market) → migration
  (`seller_plans`: seller, tier, active_until, set_by) → admin sets/renews a
  plan on the seller page (audited) → search/category ranking gives promoted
  slots to active paid sellers with a "Promoted" label → seller app shows
  their plan and perks.

### 4. Terms page (owner)
`apps/storefront-v2/src/routes/terms.tsx` still says alkemart "deducts the
agreed commission". Legal wording — the owner rewrites it for no commission
and seller plans.

### 5. Deploy with live keys (owner + developer)

Order matters — the new API expects the new tables:
**back up the database → apply 0036–0049 → deploy API → deploy the three
Pages apps → rehearse → invite sellers.**

Rehearsal on live (no public traffic yet, known shops only), each step
checked in the apps:
1. Admin signs in to admin-v2; a test seller signs in to vendor-v2 and
   finishes setup (shop, delivery zones, map pin, MoMo payout account).
2. Seller lists a product; it appears in storefront search.
3. Buyer places a small real MoMo order → seller marks delivered with the
   handover code → admin → Payouts → **Pay everyone ready** → money lands on
   the seller's MoMo.
4. Pay-on-delivery order → delivered → shows as cash on the seller's Money page.
5. Buyer reports a problem / asks for a return → seller refunds → Paystack
   refund arrives (small amount).
6. A message from buyer to shop and a reply.
Any error here is almost certainly Postgres-only code (see "Not yet proven").

Developer:
1. Items 1 above green; commit when the owner asks.
Owner:
2. Apply migrations **0036–0049** to the live database (0046 deals and 0047
   videos are parked features; applying them is harmless).
3. Paystack Ghana: business verified (KYC), Transfers enabled, "Confirm
   transfers before sending" off, webhook URL = `<API>/hooks/paystack`.
4. Set the live secret key as a Worker secret
   (`wrangler secret put PAYSTACK_SECRET_KEY`), never in files or chat.
5. Each pilot seller adds their MoMo payout account in the seller app (creates
   the Paystack recipient).
6. Deploy API + the three apps (`DEPLOYMENT.md`), then smoke test:
   buy with a small real MoMo payment → seller marks delivered with the code →
   admin "Pay everyone ready" → money arrives on the seller's MoMo.

### 6. After the pilot (decide with data)
- Escrow choice: `ESCROW-OPTIONS.md` (A now; B automatic payouts; C Paystack
  subaccounts after asking Paystack two questions; D no online payments).
- Multi-country / i18n: markets are config (`MARKETS` in
  `packages/shared/src/markets.ts`); only Ghana exists; there's no i18n layer
  yet, and `packages/domain/src/messaging.ts` contact-flag regexes are
  Ghana-specific.
- Parked: Make an offer (phase 5, `DEALS_ENABLED = false`), faster listing and
  videos (phase 6, routes unmounted), monetization settings (phase 7:
  commission by category, promos).
