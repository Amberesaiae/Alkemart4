# Blueprint Phase 0 — Decisions, governance, baselines

**Roadmap ref:** `docs/strategy/alkemart-marketplace-blueprint/12-implementation-roadmap.md` Phase 0.
**Lifecycle owner:** admin (governance) + payment (money IDs). **Blocks all other phases.**

## Goal

No unresolved dual source of truth for category labels, product identity, money,
offer selection, promotion eligibility, or trust labels before Phase 1 starts.

## Slices (in order)

### 0A. Architecture decision records

Create `docs/architecture/decisions/` with one ADR per record (status/proposed →
accepted, date, context, decision, consequences, rollback):

1. `ADR-001-product-variant-offer.md` — Product ≠ Offer, ATC binds `offerId`,
   OrderGroup splits per seller, pesewas integers. (Restates doctrine; closes
   "variant-only cart" debate.)
2. `ADR-002-product-identity-confidence.md` — Level A/B/C matching, reviewed
   merges only, no auto-merge. Defines confidence field + provenance.
3. `ADR-003-collections-vs-taxonomy.md` — vendor collections are seller-owned,
   many-to-many, never alter classification.
4. `ADR-004-campaign-placements.md` — placement + campaign + creative entities,
   eligibility-gated publishing, audit events.
5. `ADR-005-search-projection.md` — Postgres authoritative; projection worker
   placement (Workers + `CATALOG_KV` vs Meili), freshness SLO, failure handling.
6. `ADR-006-indexable-rendering.md` — deterministic HTML strategy for
   product/category/store routes (prerender vs SSR), status codes, canonicals.

Each ADR names exact tables/routes it constrains. Unresolved ADR = phase gate closed.

### 0B. Event dictionary + PII classification

Create `docs/architecture/decisions/event-dictionary.md`:

- Every event in blueprint Doc 10 with: machine ID, trigger point (file:line),
  required props (product/offer/seller/campaign/placement/category IDs distinct),
  PII classification (none by default; contact/address/payment/order-ref only
  with documented lawful need).
- Buyer/seller ID documentation: which JWT subject maps to which analytics identity.
- Retention + access controls note.

### 0C. Governance roles

Update `docs/ops/runbook.md` (append section): taxonomy owner, promotion
approver, trust-label issuer, two-person rule for payout/trust changes, review
SLAs for governance queues (Doc 02 §Governance queues).

### 0D. Baselines

Create `docs/ops/baselines.md` (snapshot table, dated): conversion
(search→PDP, PDP→cart, cart→paid/COD-confirmed), delivered-order rate,
cancellation/return/dispute/failed-delivery rates, search zero-result rate,
page CWV (LCP/INP/CLS) per surface, SEO (indexed pages, crawl errors),
seller metrics (time-to-first-offer, time-to-first-order, payout reliability).
Sources: PostHog export + smoke scripts + Search Console. No baseline = no
"improvement" claim later.

### 0E. Ghana legal/compliance review backlog

Append to `docs/ops/PAYMENTS-LAUNCH-GATE.md`: regulated-category evidence list
(food, cosmetics, medicines, agrochemicals, electrical, safety equipment),
Data Protection Act controller/processor mapping task, prohibited/restricted
product policy task. Mark each `needs-qualified-review: true`.

## Tests / verify

- Docs-only phase: `bun run typecheck` unaffected; review checklist in PR body.
- Acceptance: all 6 ADRs accepted; event dictionary covers Doc 10 discovery +
  product + commerce + merchandising + seller events; baselines table filled.

## Unconstructive flags

- Starting Phase 1 schema work with any ADR still `proposed`.
- Capturing baselines from initiated-checkout only (must include delivered orders).
- Putting PII (phone, address, order refs) into analytics props "temporarily."
