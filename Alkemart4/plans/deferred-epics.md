# Deferred epics — scopes for separate projects

The trust/growth and store-manager backlogs are done. What remains was
explicitly deferred. Each item below is scoped so it can be picked up
independently; none is started.

## R1 — Buyer reviews on the storefront PDP (follow-up to the reviews loop)

API + vendor/admin UIs exist (`reviews` table, `/store/reviews`,
`/vendor/reviews/*`, `/admin/reviews`). Missing buyer-visible surface:

- `GET /store/products/:id` gains `reviews: { rating, title, body,
  vendorResponse }[]` (published only) + aggregate (`avg`, `count`).
- PDP renders the aggregate + list (paginated, 5/page). No dead controls:
  hide the section when count is zero.
- Notify vendor on publish (outbox row, same pattern as fulfillment SMS).
- Tests: published-only filter, aggregate math, pagination.

## R2 — ML fraud scoring

No design yet. Suggested thin slice before any model work:

- Feature log: `risk_events (order_id, signals jsonb, score, verdict,
  created_at)` written at checkout from rules already in code (velocity,
  amount outlier vs seller median, new-buyer + COD + high value).
- Start with the rules engine + review queue in admin (`/disputes`
  adjacent); promote to a model only when labels accumulate.
- Do NOT auto-cancel on scores until precision is measured.

## R3 — Multi-shop per account

Architectural. Current invariant: one seller per member (`seller_members`
is effectively 1:1, JWT carries a single `sellerId`).

- Migration: allow N memberships; session carries `activeSellerId`
  (already the shape in `seller.me()` client persistence).
- Touch points: `requireSeller` (select shop), vendor switcher UI,
  per-shop readiness/health/tasks scoping, checkout seller resolution.
- Risk: auth middleware + every `sellerIdOrThrow` call site. Estimate:
  larger than P1–P3 combined. Do not start without a dedicated plan.

## R4 — i18n beyond English

- Today: `admin/src/i18n/en.json` only, plus hardcoded copy everywhere.
- Path: extract strings per app behind the existing i18n helper, add Twi/Ga
  catalogs for buyer surfaces first (storefront), vendor/admin later.
- Needs a native-speaker review pass before shipping any locale.
