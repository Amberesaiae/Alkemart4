# Blueprint Phase 4 — Storefront and seller operating system

**Roadmap ref:** roadmap Phase 4. **Requires:** Phase 1 identity/attributes;
Phase 3 trust read model. **Lifecycle owner:** vendor + admin.

## Goal

A seller can set up a polished store, organize products independently of
marketplace taxonomy, fulfill orders, understand payouts, and measure results
from a phone.

## Slices

### 4A. Vendor collections (first-class data)

- DB: `collections` (seller, name, slug, description, art, visibility
  draft/published, order, schedule) + `collection_products` (many-to-many,
  position). New schema file, export in `packages/db/src/schema/index.ts`.
- API: vendor CRUD + ordering + visibility + schedules
  (`apps/api/src/routes/vendor/` new `collections.ts` + test); public read in
  store routes (eligibility-filtered).
- Storefront: `routes/shops.$slug.tsx` + shops index render real collections
  (replace inferred/derived sections); collection routes; store search.
- Tests: cross-category membership test (products from multiple marketplace
  categories, classification untouched); visibility/schedule test; isolation test.

### 4B. Shop profile / Studio normalization

- Normalize seller metadata (parsers today) with validation, media pipeline
  rules, policy versioning (`shop-policies.ts` extend), preview = buyer view.
- UI: vendor Store tab (`apps/backend/apps/ghana-vendor`) + `ShopStudio.tsx`
  hardening; public shop anatomy per blueprint (identity, trust, fulfillment,
  navigation, merchandising, catalog, proof, policies, story).
- Keep existing store-page visual skeleton as base (blueprint instruction).

### 4C. Seller dashboard IA

- Vendor app nav across catalog / orders / money / reputation / growth
  (`apps/backend/apps/ghana-vendor` routes): setup+identity, catalog+inventory
  (bulk edit, match suggestions per 1D, quality score, media feedback,
  collections, featured), orders+fulfillment (queue, SLA timers,
  pick/pack/ready/handover/delivered, cancellations/returns/disputes+evidence),
  money (gross/commission/fees/refunds/net, schedule/status, reconciliation,
  downloadable statements, payment-account readiness without credential
  exposure), customers+reputation (structured moderated enquiries, reviews + one
  response, repeat/collection insights without excess PII), growth (visits,
  impressions, conversion, top search terms, campaign performance,
  low-stock/stale/content recommendations, shareable links).
- Mobile-first: drafts survive interrupted connectivity; compressed resumable
  images; short unambiguous status actions; notifications deep-link to tasks.

### 4D. Payout reconciliation + statements

- API: extend `apps/api/src/routes/admin/payouts.ts` read model for sellers
  (holds/reasons, net ledger lines); seller statement download (CSV/PDF-ready
  JSON first).
- UI: vendor money tab reconciliation view.
- Tests: existing `payouts.test.ts` extended — hold/reason, net math in pesewas.

### 4E. Bulk ingestion + education (safe subset)

- Vendor CSV/feed import: validation, dry-run, row errors, idempotency, match
  review queue (never direct publish for regulated types).
- Contextual playbooks (setup, quality, fulfillment, growth) as in-dashboard
  guidance, not docs-only.

## Migration / rollback

- Featured-products (`shop-featured.ts`) map to collections; keep reader until
  migrated. Rollback = collections hidden, featured reader restored.

## Acceptance

 New seller on a phone: account → readiness → first product+offer → review →
 fulfillment+policies → order → payout statement; store organizes products
 independent of taxonomy; dashboard shows why sales happen.

## Unconstructive flags

- Collections altering canonical classification; exposing buyer PII beyond
  own-order fulfillment data; credential exposure in payment-readiness UI;
  front-loading advanced catalog requirements before first-order value.
