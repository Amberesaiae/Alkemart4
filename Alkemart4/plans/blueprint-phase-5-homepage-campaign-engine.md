# Blueprint Phase 5 — Homepage campaign engine

**Roadmap ref:** roadmap Phase 5. **Requires:** Phase 1–4 read models
(eligibility, collections, trust). **Lifecycle owner:** admin.

## Goal

An admin can schedule a responsive campaign tied to eligible in-stock products,
preview it accurately, publish safely, and measure delivered commercial value.

## Slices

### 5A. Placement + campaign entities

- DB: `placements` (code, job, maxLive, constraints), `campaigns` (per Doc 06
  type: objective, placement, audience/product/seller sets, eligibility +
  terms refs, desktop+mobile creatives, schedule, priority, frequencyCap,
  trackingId, status draft|review|scheduled|live|ended), `creatives`,
  `product_sets`, `seller_sets`, `promotion_terms`, audit history table.
- Domain: eligibility evaluation (price/image/stock/publication/seller-state),
  conflict/priority resolution (deterministic), auto-expiry rule.
- API: `apps/api/src/routes/admin/homepage.ts` rewrite onto entities;
  `apps/api/src/routes/store/homepage.ts` serves resolved course (placements
  with winning live campaigns + rule-backed shelves).
- Tests: conflict-resolution test; expired-terms auto-offline test;
  ineligible-product exclusion test.

### 5B. Studio workflow

- Admin homepage route: brief → objective/placement → product/seller set →
  eligibility+terms → responsive creative → buyer-view preview (phone/tablet/
  desktop widths, delivery-area + signed-in/out contexts) → validate → review/
  approve → schedule/publish → monitor → expire/archive; draft-vs-live
  comparison; revision history + rollback; upcoming/ending calendar; asset
  usage/expiry inventory.
- Validation blocks/warns per Doc 06 list (destination, creatives, schedule,
  terms, product/seller eligibility, priority conflict, claims, duplication,
  tracking ID).

### 5C. Canonical course alignment

- `packages/shared/src/homepage.ts`: evolve `HomeSection` content-union →
  placement + campaign + source contracts; `composeMarketCourse()` renders one
  canonical course across breakpoints; live rendering and Studio preview share
  the resolver (no two truths).
- Storefront `routes/index.tsx` + `lib/homepage.ts` consume resolver output;
  empty rule-backed sections collapse honestly; sponsored labeled; one campaign
  cannot dominate adjacent placements.

### 5D. Merchandising sources + attribution

- Rule-backed shelves define eligibility before ranking (trending / most
  ordered = delivered units / top rated = verified count+confidence / near me /
  new / price-drop = real history); manual curation records editor/reason/
  schedule/sponsorship.
- Analytics: `view_promotion` / `select_promotion` with placement, campaign,
  creative, set, position, audience context; delivered-revenue attribution.

## Migration / rollback

- Map existing `content_pages` JSON sections to placements; preserve active
  creatives; keep compatibility reader until all published documents migrated.
  Rollback = reader + last-known-good snapshot republish.

## Acceptance

 Campaign with eligible in-stock products: preview matches buyer view at 3
 widths, publishes on schedule, expires automatically, reports delivered
 revenue by placement/creative/set.

## Unconstructive flags

- Arbitrary blocks bypassing placements; creative promising unsupported
  discount/delivery/authenticity/stock; duplicating baked-in headline as
  overlay; personalization hiding essential navigation; performance overriding
  relevance/policy eligibility.
