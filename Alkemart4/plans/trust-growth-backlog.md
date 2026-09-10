# Trust & Growth backlog — implementation plan

Two threads (admin trust, vendor growth), ordered by dependency. Each item
is independently shippable with tests + tsc + MCP click-through + screenshots.
Conventions: Medusa paths are dead — Workers only; unwired surfaces stay
unrendered behind the `/unavailable` guard; every mutation returns shapes the
UI already consumes.

## T1 — Admin action audit log (build first; everything trust-related reads it)

- Migration: `admin_actions (id, admin_user_id FK users, action text, target_type text, target_id text, detail jsonb, created_at)`.
- Helper `logAdminAction(db, {adminUserId, action, target})` called inside the
  admin sellers/products/orders/payouts routes AFTER successful writes
  (approve, suspend, unsuspend, terminate, commission, product approve/reject/
  request-changes, payout trigger, dispute resolve).
- Read endpoint `GET /admin/actions?target=&limit=` (admin-only) for a future
  timeline UI. No UI in T1 beyond logging.
- Tests: approve-seller writes one row with actor + target (extend
  `sellers.test.ts` style with InMemory — needs an in-memory action store on
  the repo or a passed-in sink; prefer a `logSink` option on `createApp`).
- Acceptance: every mutating admin route in the list above emits a row;
  failing writes emit nothing.

## T2 — Moderation bulk actions

- UI only (endpoints exist per-item): checkbox column + header toggle on
  product-moderation + sellers-queue, sticky bulk bar (Approve/Reject +
  count + confirm dialog), sequential execution with per-item failure report
  (toast lists what failed, successes invalidate queries).
- `aria`: checkbox column header has sr-only label; bulk bar `role="toolbar"`.
- Acceptance: 3-item bulk approve publishes all; one failing item reports
  without blocking the others (simulate via 409 test double).

## T3 — Vendor tasks card (read-model only, no migration)

- New `GET /vendor/tasks` composing existing reads: orders placed
  (dispatch), products rejected/changes-requested, pending approval state,
  payout payable balance, profile gaps (no logo, no MoMo).
- Dashboard card: ordered by urgency, each row deep-links to its surface.
  Empty state celebrates ("All clear — nothing needs you").
- Tests: fabricated repos asserting task derivation rules.

## T4 — Fulfill notifies buyer

- On vendor mark-shipped/delivered: enqueue SMS via Africa's Talking
  (sender ID must be NCA-registered before prod — file early, stub in dev).
- New `notifications` outbox table (idempotent key = order id + status) +
  worker/cron sender with retry; failures never block the status write.
- Acceptance: status flips even if SMS provider is down (test with stub);
  no duplicate SMS on retry (unique key test).

## T5 — Traffic stats (unlocks conversion loop + admin analytics)

- `shop_views (seller_id, product_id null, day date, views int)` day-grain
  counters incremented by storefront shop/PDP routes (fire-and-forget,
  sampled if hot).
- `GET /vendor/stats/shop` (views 30d, top products by views) and
  `GET /admin/stats/traffic` reusing the bucket pattern from
  `routes/admin/stats.ts`.
- Vendor dashboard: visits → conversion → revenue trio (Insight Agent weekly
  cadence); admin analytics: traffic card.

## T6 — Moderation auto-flag rules (human still decides)

- Pure functions over product payloads run at propose-time, stored as
  `moderation.flags[]` with reasons: no image, price outlier vs category
  median (>3× or <0.2×), banned-word list, duplicate title vs live catalog.
- Queue sorts flagged-first; flag chips render in the review card with
  reasons visible to moderators. No auto-reject.
- Tests: one fixture per rule + sort-order test.

## T7 — Account health (vendor) + appeals inbox (admin)

- Health scorecard from existing signals: verification, payout readiness,
  policy flags, fulfillment timeliness → green/amber/red with plain-language
  "do this" items. Read-only first.
- Appeals: vendor "why?" thread on rejected items + admin inbox view with
  reply + reverse action. Needs `moderation_appeals` table (item, seller,
  message thread, status).

## Explicitly deferred
Review write path (buyer→vendor→moderation loop), ML fraud scoring,
multi-shop accounts, i18n beyond English.
