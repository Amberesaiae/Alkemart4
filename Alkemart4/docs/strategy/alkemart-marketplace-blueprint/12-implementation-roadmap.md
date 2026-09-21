# 12 — Implementation roadmap

## Delivery rules

- Build data authority before visual dependence on that data.
- Use vertical slices that reach buyer/seller interfaces, API, database,
  analytics, policy, and tests.
- Preserve working commerce flows while foundations migrate.
- Do not start advanced personalization before identity, eligibility, and event
  quality are reliable.
- Each phase requires explicit migration, rollback, observability, and data
  ownership notes.

## Dependency sequence

```text
governance + measurement
        ↓
taxonomy + product identity + attributes
        ↓
search/facets + comparison integrity
        ↓
collections/store operations + campaign engine
        ↓
SEO/feed/content + lifecycle growth
        ↓
recommendations and optimization
```

## Phase 0 — Decisions, governance, and baselines

### Outcomes

- Blueprint terminology is canonical.
- Launch departments, regulated-category boundaries, and trust claims approved.
- Buyer, seller, catalog, campaign, and analytics IDs documented.
- Current conversion, search, order, delivery, seller, performance, and SEO
  baselines captured.

### Work

- Architecture decision records for Product → Variant → Offer, product identity
  confidence, collections, and campaign placements.
- Event dictionary and PII classification.
- Taxonomy and promotion governance roles.
- Ghana legal/compliance review backlog.
- Accessibility and performance test baselines.

### Exit gate

No unresolved dual source of truth for category labels, product identity, money,
offer selection, promotion eligibility, or trust labels.

## Phase 1 — Catalog identity and taxonomy

### Vertical slices

1. Taxonomy lifecycle, aliases, redirect, assignable/browseable/nav flags.
2. Brand/model/GTIN/MPN/product-type and identity-confidence fields.
3. Typed attribute definitions and one complete category profile (Phones).
4. Product-match candidate and admin/seller confirmation workflow.
5. Department theme source shared across API/storefront/admin.

### Migration

- Backfill current categories into active versioned nodes.
- Treat free-form attributes as legacy values and map only validated fields.
- Do not auto-merge existing products without reviewed evidence.

### Exit gate

A seller can publish a branded phone without a barcode, enrich its structured
attributes, and safely match it to a canonical product through review.

## Phase 2 — Discovery and search quality

### Vertical slices

1. Attribute-backed facets and counts for Phones.
2. Search projection/outbox and index freshness dashboard.
3. Alias/synonym/query-redirect governance.
4. Zero-result recovery and search-quality analytics.
5. Mobile/desktop filter parity with URL restoration.

### Exit gate

Filters shown for Phones are completely data-backed; search and category pages
agree on eligible products, counts, price, and availability.

## Phase 3 — Offer comparison and trust

### Vertical slices

1. Extend offer terms: condition, origin, fulfillment, warranty/return refs,
   price history, freshness.
2. Variant-safe peer-offer API.
3. Total-cost comparison and delivery-area eligibility.
4. Buyer-facing ranking explanation and sorting.
5. Decomposed seller verification and operational trust.
6. Product-versus-seller review aggregation.

### Exit gate

For an exact product/variant, buyers can compare honest total offers and switch
seller without stale price, stock, delivery, or cart state.

## Phase 4 — Storefront and seller operating system

### Vertical slices

1. Vendor collection schema, CRUD, ordering, visibility, and public routing.
2. Storefront editor with buyer-view preview.
3. Seller dashboard navigation across catalog, orders, money, reputation, and
   growth.
4. Seller analytics and actionable product/stock/content recommendations.
5. Payout reconciliation and downloadable statements.

### Exit gate

A seller can set up a polished store, organize products independently of the
marketplace taxonomy, fulfill orders, understand payouts, and measure results
from a phone.

## Phase 5 — Homepage campaign engine

### Vertical slices

1. Placement definitions and canonical responsive course.
2. Campaign, creative, product/seller set, eligibility, and terms entities.
3. Studio brief → validation → preview → review → schedule workflow.
4. Conflict detection, auto-expiry, revision, rollback, and audit events.
5. Promotion/item-list impression and outcome attribution.

### Migration

Map existing homepage sections to placements and preserve active creatives.
Keep a compatibility reader until all published documents are migrated.

### Exit gate

An admin can schedule a responsive campaign tied to eligible in-stock products,
preview it accurately, publish safely, and measure delivered commercial value.

## Phase 6 — SEO, feeds, and content authority

### Vertical slices

1. Correct product/store/organization/breadcrumb structured data.
2. Deterministic HTML for product, category, and eligible store routes.
3. Live sitemap index and canonical/robots validation.
4. Merchant product feed and diagnostics.
5. Editorial content model, guide templates, and internal-linking rules.
6. Initial Ghana buying/comparison content clusters.

### Exit gate

Every indexable product is crawlable through navigation or sitemap, product
markup represents variants and seller offers honestly, and feed/site facts
agree.

## Phase 7 — Lifecycle and marketplace growth

### Vertical slices

1. Preference center and notification classification.
2. Saved product/search and back-in-stock/price-change events.
3. Review-request lifecycle after delivery.
4. Seller order/stock/payout/action alerts.
5. Campaign holdouts and experiment registry.

### Exit gate

Growth messages are permission-aware, attributable, frequency-controlled, and
measured through delivered orders, returns, complaints, and seller outcomes.

## Phase 8 — Optimization and responsible expansion

- Category/attribute-aware alternatives.
- Location and delivery-aware ranking.
- Recommendation systems with diversity and guardrails.
- Automated taxonomy proposals from evidence.
- Seller quality interventions and education.
- New product-commerce departments when demand and operations justify them.
- Separate architecture exploration for non-product verticals, if desired.

## Cross-phase test matrix

Every phase includes:

- Domain and schema tests.
- API contract/integration tests.
- Authorization and cross-seller isolation tests.
- Responsive buyer and seller E2E paths.
- Accessibility checks.
- Analytics schema checks.
- SEO/structured-data validation where applicable.
- Migration and rollback rehearsal.
- Fraud/abuse cases for relevant features.

## First implementation plan decomposition

Do not create one monolithic implementation plan. Produce reviewed plans in
this order:

1. Taxonomy lifecycle and product identity.
2. Typed attributes and Phones profile.
3. Search projection and category-aware facets.
4. Exact offer comparison and trust.
5. Vendor collections and storefront Studio.
6. Campaign/placement Studio.
7. SEO rendering, structured data, and feeds.
8. Analytics/lifecycle growth.

Each plan should name exact files after re-auditing the then-current tree.
