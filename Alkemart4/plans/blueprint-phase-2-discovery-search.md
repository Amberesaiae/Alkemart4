# Blueprint Phase 2 — Discovery and search quality

**Roadmap ref:** roadmap Phase 2. **Requires:** Phase 1 typed attributes + Phones
profile; ADR-005 accepted. **Lifecycle owner:** buyer.

## Goal

Filters shown for Phones are completely data-backed; search and category pages
agree on eligible products, counts, price, and availability.

## Slices

### 2A. Search projection / outbox

- DB: outbox table (entity, entityId, op, payload, claimed/acked) written in the
  same tx as product/variant/offer/taxonomy/seller/review writes
  (`packages/db/src/schema/` new `search-outbox.ts`, export in `index.ts`).
- API/worker: projection consumer (per ADR-005 placement) rebuilding
  documents from products + variants + offers + taxonomy + collections +
  sellers + reviews; only published, eligible, in-policy records indexed.
- Ops: index-freshness + failure dashboard endpoint (`apps/api/src/routes/admin/stats.ts`
  extend) + `docs/ops/runbook.md` alert thresholds.
- Tests: outbox-written-in-tx test; rebuild-from-empty test; ineligible-record
  exclusion test.

### 2B. Attribute-backed facets (Phones first)

- API: `apps/api/src/routes/store/products.ts` + `categories.ts` — facet
  endpoint returning definition-backed values **with server counts**; price,
  availability, delivery/pickup eligibility, condition, trust tier (when
  meaningful), rating (only when reviewed products exist).
- Storefront: `routes/categories.$slug.tsx`, `components/listing/*`
  (`ListingFacets.ts`, `ListingFilters.tsx`, `ListingFilterDropdown.tsx`,
  `ListingAppliedFacets.tsx`) consume server facets; **delete client-side
  filtering over arbitrary JSON labels**; URL owns facet state; applied filters
  individually removable; counts update per commit; mobile sheet with explicit
  result count + apply; back/forward restores state.
- Tests: facet-count agreement test (API vs rendered); URL-restore test;
  zero-result filter disabled-or-explained test.

### 2C. Alias / synonym / redirect governance

- DB: `search_aliases` (term, target, type synonym|redirect, status, reviewer).
- API: admin alias CRUD + review queue; search applies approved aliases only.
- UI: admin console screen; zero-result query queue feeds alias candidates.
- Tests: unapproved seller spelling never becomes global synonym test.

### 2D. Zero-result recovery + quality analytics

- Storefront `routes/search.tsx`: spelling/alias suggestions, one-constraint
  relaxation with explanation, relevant categories/shops, preserve query for
  taxonomy queue; **no unrelated-trending filler**.
- Analytics: `search_submitted`, `search_zero_results`, `search_refined`,
  `filter_applied/removed`, `category_viewed` (extend
  `apps/storefront/src/lib/analytics.ts` + `search.ts` call sites).
- Dashboard: admin search-quality view (zero-result rate, refinement rate,
  low-click queries, Other-bucket products).

### 2E. Filter parity + cards

- Mobile/desktop parity audit for `ListingFilters`; product cards answer only
  what/price/availability/trust/action; seller-count/comparison prompts only
  when aiding decision; variant grouping (no near-duplicate card floods).

## Migration / rollback

- Dual-run old `q`-substring path behind flag until freshness dashboard green
  for one full catalog cycle; rollback = flag off, projection paused.

## Acceptance

 Phones PLP + search agree on product set, counts, price, availability;
 zero-result page recovers honestly; dashboard shows freshness < SLO.

## Unconstructive flags

- Facets from browser-side JSON labels; indexing seller spellings as global
  synonyms without review; marketing boosts outranking exact matches;
  filling zero-result pages with unrelated trending products.
