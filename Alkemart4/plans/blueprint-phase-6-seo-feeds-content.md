# Blueprint Phase 6 — SEO, feeds, and content authority

**Roadmap ref:** roadmap Phase 6. **Requires:** Phase 1 identity, Phase 3
offer/trust truth, ADR-006 rendering decision. **Lifecycle owner:** buyer
(external discovery).

## Goal

Every indexable product is crawlable via navigation or sitemap, markup
represents variants and seller offers honestly, and feed/site facts agree.

## Slices

### 6A. Structured-data correction (quick win already shipped: seller-as-Brand
removed; this slice completes the model)

- `apps/storefront/src/lib/seo.ts`: true manufacturer/product `brand` (from
  Phase 1 `products.brand`, omitted when unknown — never seller, never site
  fallback); `ProductGroup` + `Product` variants; `Offer`/`AggregateOffer`
  with seller identity on the offer; `AggregateRating` only for eligible
  verified reviews; shipping + merchant-return policy data; `BreadcrumbList`;
  `Organization`; `Store`/local-business for qualifying shops.
- Call sites: `routes/product.$id.tsx`, `routes/categories.$slug.tsx`,
  `routes/shops.$slug.tsx`.
- Tests: new `seo.test.ts` — seller-never-in-brand, variants present,
  rating gated, feed parity sample.

### 6B. Deterministic HTML + crawl hierarchy

- Per ADR-006: indexable routes (top subcategories, canonical products,
  qualifying shops/collections, guides, policy/help) render deterministically
  (extend `scripts/prerender-pdp.mjs` pattern to categories/stores or SSR —
  whichever ADR-006 chose); correct status codes + canonicals in initial HTML;
  Home → department → subtype → product reachable by real anchors; stable
  pagination/incremental loading that stays crawlable.
- Non-indexable: account/cart/checkout/private, internal search, thin filter
  perms, empty stores/collections, duplicate campaign destinations
  (`noindex` via `applyPageSeo({ noindex: true })` — already supported).

### 6C. Sitemap + robots production behavior

- Replace `public/sitemap.xml` placeholder with live sitemap index +
  segmented product/category/store maps (API-generated, cached in KV);
  canonical/robots validation test against production origin; remove
  deployment-specific stale origins (`VITE_PUBLIC_SITE_URL` audit).
- Monitoring: Search Console + crawl-error + structured-data validation notes
  in `docs/ops/runbook.md`.

### 6D. Merchant feed + diagnostics

- New feed pipeline (stable IDs, titles, descriptions, links, images, price,
  availability, condition, brand, identifiers, product type, shipping/return;
  feed↔landing-page agreement check; diagnostics for missing IDs, price
  mismatch, stale availability, image problems, policy disapproval).
- Marketplace-account strategy note (availability varies by country — build
  for data quality, not a specific program feature).

### 6E. Editorial content model (thin slice)

- Content model: guides, authorship, editorial workflow, internal-link rules,
  refresh schedule; hub-and-spoke clusters linking to products/categories only
  when relevant; live catalog facts (price/stock) pulled from data, never
  embedded in prose. Ship 1 pilot cluster (Ghana buying/comparison) + templates.

## Migration / rollback

- Prerender list grows incrementally; placeholder sitemap kept until live
  index validated in Search Console; rollback = revert to CSR + noindex new routes.

## Acceptance

 Sample product/category/shop URLs: initial HTML carries title/meta/canonical/
 JSON-LD; sitemap lists them; feed agrees on price/availability/brand;
 expired/unavailable returns successor/unavailable/410 (never homepage redirect).

## Unconstructive flags

- Client-only metadata for critical product info; variant duplication across
  URLs; faceted crawl traps; indexed search pages; soft-404 expired campaigns;
  UGC spam; claiming unavailable prices/ratings/brands; thin AI category pages.
