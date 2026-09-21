# 11 — Repository gap audit

**Audit basis:** repository state at commit `bc9fe17`, reviewed 2026-09-21.

This is a planning audit, not a claim that existing features are production
complete. “Partial” means a useful foundation exists but the blueprint contract
is not yet satisfied end to end.

## Catalog and taxonomy

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Category tree | Partial | `packages/db/src/schema/categories.ts` | Only id/handle/name/parent/rank/nav; no lifecycle, alias, redirect, assignable/browseable distinction, profile, version |
| Product identity | Partial | `packages/db/src/schema/products.ts` | Canonical title exists; no brand, model, GTIN, MPN, manufacturer, provenance, confidence |
| Variants | Partial | `products.ts`, `product-options.ts` | Options and combinations exist; no governed axes, uniqueness/index coverage, dimensions/weight, identity confidence |
| Offers | Partial | `offers.ts` | Seller/variant/price/stock exist; missing condition, compare-at provenance, fulfillment origin, warranty/returns, freshness |
| Typed attributes | Untouched | Product attributes are JSON `{label,value}` | Add definitions, profiles, typed values, units, filter/search metadata |
| Vendor collections | Untouched | No schema | Add collections, product joins, art, visibility, order, schedules |
| Product matching | Untouched | No canonical merge/match workflow | Add candidate matching, confidence, admin/seller review, merge history |
| Department themes | Partial | Frontend category metadata | Move governed theme data into shared/domain/API source with contrast validation |

## Discovery

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Category PLP | Partial | `routes/categories.$slug.tsx` | Strong URL-state foundation; facets remain limited and partly client-filtered |
| Applied facets | Implemented foundation | `components/listing/ListingFacets.ts`, `ListingAppliedFacets.tsx` | Connect to definition-backed server counts and search projection |
| Responsive filters | Partial | `ListingFilters.tsx`, `ListingFilterDropdown.tsx` | Replace static facet inventory with category profiles; audit mobile result/apply behavior |
| Search facets | Partial | `routes/search.tsx` | Depends on available distribution; needs normalized attribute facets and quality dashboard |
| Search projection | Partial/uncertain operationally | Search integration references exist | Add/verify outbox, complete document rebuild, index freshness, aliases, failures, tenant rules |
| Search analytics | Minimal | `lib/analytics.ts` | Add zero-result, refinement, suggestion, abandonment, impression/click attribution |
| Query governance | Untouched | No alias/review console found | Add synonyms, redirects, zero-result and seller-language review queues |

## Product and comparison

| Capability | State | Evidence | Gap |
|---|---|---|---|
| PDP | Substantial foundation | `routes/product.$id.tsx` | Reconcile hierarchy against blueprint and complete data contracts |
| Peer offers | Partial | `PeerOffersList.tsx`, peer-offer API models | Add variant certainty, delivery/total cost, policy differences, sort/explanation |
| Active offer selection | Partial | PDP and quick-buy logic | Ensure all price, stock, delivery, policy, and cart state switches atomically |
| Product alternatives | Untouched/limited | No governed similarity model found | Add category/attribute-aware alternatives distinct from exact offers |
| Price integrity | Partial | Integer money and offer price | Add price history, compare-at provenance, promotion terms, anomaly review |
| Product versus seller reviews | Partial | `reviews.ts` stores both IDs | Split presentation/aggregation dimensions and add fraud/helpfulness controls |

## Storefront and seller operations

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Public shops | Substantial foundation | `routes/shops.$slug.tsx`, shops index | Preserve design; replace derived sections with real collections and complete SEO/trust |
| Shop profile/studio | Partial | seller metadata parsers, `ShopStudio.tsx` | Normalize metadata, validation, preview, media, policy/version workflows |
| Featured shop products | Partial | `shop-featured.ts` | Extend to collections and scheduled merchandising |
| Seller dashboard | Partial | Ghana vendor app | Add coherent catalog/inventory/orders/money/reputation/growth information architecture |
| Seller analytics | Minimal | `shop-views.ts` | Add product impressions, conversion, search terms, campaign and fulfillment metrics |
| Payouts | Foundation | payout schema/routes | Add seller-facing reconciliation, statements, holds/reasons, operational controls |
| Bulk catalog ingestion | Untouched | No seller import/feed workflow found | Add safe CSV/feed import, validation, dry-run, row errors, idempotency, and match review |
| Seller education | Untouched as system | Guidance exists mainly in UI copy/docs | Add contextual setup, quality, fulfillment, and growth playbooks |

## Homepage and Studio

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Section model | Strong prototype | `packages/shared/src/homepage.ts` | Evolve from content union to placement + campaign + source contracts |
| Course composition | Partial | `composeMarketCourse()` | Align live rendering and Studio preview to one canonical course across breakpoints |
| Studio editor | Strong prototype | admin homepage route and registry | Add objective, eligibility, terms, responsive assets, conflicts, approvals, calendar |
| Campaign data | Untouched | Sections stored as JSON in `content_pages` | Add campaign/creative/product-set/placement entities and audit history |
| Promotion analytics | Untouched | No placement/campaign event contract | Add impression, selection, conversion, delivered-revenue attribution |
| Experimentation | Untouched | No experiment model found | Add controlled exposure/assignment only after event reliability |

## SEO and growth

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Route metadata | Partial | `lib/seo.ts`, `page-seo.tsx` | Move critical metadata into deterministic initial HTML for indexable routes |
| Product JSON-LD | Incorrect/partial | `productJsonLd()` | Seller is currently emitted as brand; add true brand, variants, aggregate offers, rating/policies |
| PDP prerender | Partial | `scripts/prerender-pdp.mjs` | Verify production integration and expand strategy to categories/stores |
| Sitemap | Placeholder/partial | `public/sitemap.xml`, store sitemap API references | Generate live sitemap index and segmented product/category/store maps |
| Robots/canonical origin | Partial | `public/robots.txt`, env origin | Remove deployment-specific stale origins and test production behavior |
| Merchant feed | Untouched | No feed pipeline found | Add feed generation, sync, diagnostics, and marketplace-account strategy |
| Content system | Untouched | No commerce editorial model found | Add guides, authorship, editorial workflow, internal links, refresh schedule |
| Lifecycle marketing | Minimal | Notification infrastructure exists | Add preference center and explicit buyer/seller journeys |
| Recommendations | Untouched as governed service | Some related-product presentation exists | Add product-type/attribute-aware alternatives only after catalog quality |

## Checkout, fulfillment, and service operations

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Multi-seller cart/order split | Foundation | cart, checkout, order-group schemas/routes | Audit pricing/availability revalidation, seller-level delivery, partial failure, cancellation, and refund semantics |
| Delivery eligibility | Partial | seller fee/region metadata and delivery UI | Add normalized service areas, methods, pickup points, ETA bands, capacity, and quote provenance |
| Addressing | Partial | Ghana digital-address and delivery fields | Add validation/fallback landmarks, regional usability, and safe seller disclosure |
| Returns/disputes | Foundation | returns schema and buyer flows | Complete seller/admin SLAs, evidence, partial refunds, status notifications, and reporting |
| Customer support | Partial | contact/help surfaces | Add order-linked cases, ownership, escalation, response targets, and fraud handoff |
| Notification orchestration | Partial | notifications schema/adapters | Add event matrix, preferences, retries, templates, channel fallbacks, and delivery audit |
| Marketplace operations | Untouched as console | Individual admin queues exist | Add integrated operational views for catalog quality, seller risk, delivery failures, disputes, and campaign incidents |

## Trust, safety, compliance, and operations

| Capability | State | Evidence | Gap |
|---|---|---|---|
| Seller status/moderation | Foundation | sellers status, admin queues | Add decomposed verification evidence, expiry, revocation, appeals, risk limits |
| Product moderation | Partial | moderation routes and appeals | Add category policy engine, regulated evidence, counterfeit/recall workflows |
| Verified reviews | Foundation | delivered-order review schema | Add fraud detection, dimensional aggregation, helpfulness, media policy |
| Audit logs | Partial | `admin-actions.ts` | Expand sensitive seller/product/campaign/payout actions and retention |
| Privacy | Partial | privacy page and analytics PII filter | Add operational data map, consent/preferences, retention, access/deletion process |
| Accessibility QA | Untouched as program | Components have accessibility work | Add automated/manual regression matrix across browse, PDP, cart, checkout, Studio |
| Performance budgets | Untouched as governance | No enforced budget found | Add bundle/image/CWV thresholds and CI/monitoring |
| Media pipeline | Partial | URL/media fields and generated assets | Add upload security, transforms, quality rules, variant/gallery ownership, moderation, and lifecycle cleanup |
| Localization | Partial | Ghana currency/region primitives | Keep English/GHS first; design copy, units, and data models so future locale support does not fork taxonomy |

## Analytics

`apps/storefront/src/lib/analytics.ts` provides an env-gated, non-blocking,
PII-filtered PostHog foundation with page, product, add-to-cart, checkout,
purchase, search, store, and homepage events. It does not yet cover item-list
impressions/selections, filters, comparison, offer selection, promotions,
delivery checks, refunds/returns, delivered orders, or campaign attribution.

## Immediate correctness risks

1. Product JSON-LD maps seller name into `Brand`, conflating product identity
   and merchant identity.
2. Free-form attributes cannot safely power category filters or comparison.
3. Exact comparison coverage can be overstated without identity-confidence
   governance.
4. Homepage creative can outpace campaign eligibility and analytics.
5. SEO relies partly on SPA mutation and placeholder/static files.
6. Seller storefront collections are inferred rather than first-class data.
7. Current analytics optimize initiated actions more readily than delivered
   commerce and marketplace quality.
