# 08 — SEO and external discovery

## Search architecture

Indexable routes:

- Top-level and valuable subcategory pages.
- Canonical product pages.
- Public seller shops with substantial unique content and active inventory.
- Valuable seller collections when curated and stable.
- Original buying guides and policy/help pages.

Non-indexable routes:

- Account, cart, checkout, and private seller/admin pages.
- Internal search results.
- Thin or transient filter permutations.
- Empty stores/collections.
- Duplicate campaign destinations.

## Crawlable hierarchy

```text
Home
→ department
→ subcategory/product type
→ product
```

Stores and editorial guides add contextual links but do not replace category
reachability. Use real anchors and live segmented XML sitemaps.

## Canonical product and variant URLs

- One canonical URL for the product group.
- Variants are directly addressable through stable parameters or paths when
  they materially change images, price, or availability.
- The canonical relationship is consistent across HTML, sitemap, internal
  links, and product feeds.
- Removed products return an appropriate successor, unavailable state, or 410;
  never redirect everything to the homepage.

## Structured data

- `Organization` with marketplace identity and policies.
- `BreadcrumbList` on category/product/store pages.
- `ProductGroup` and `Product` variants.
- `Offer` or `AggregateOffer` for truthful multi-seller coverage.
- `AggregateRating` only for eligible verified reviews.
- Shipping and merchant return policy data where supported.
- `Store`/local business information for suitable public shops.

The product brand is the manufacturer/product brand, not the marketplace
seller. Seller identity belongs to the offer.

## Product feeds

Generate a marketplace product feed with stable IDs, titles, descriptions,
links, images, price, availability, condition, brand, identifiers, product
type, and shipping/return information. Feed and landing-page data must agree.
Use diagnostics for missing identifiers, price mismatch, stale availability,
image problems, and policy disapproval.

## Category pages

Each indexable category needs:

- Unique, buyer-oriented title and description.
- Clear child navigation.
- Filterable product list.
- Short guidance appropriate to the category.
- Internal links to useful guides.
- Stable pagination/incremental loading that remains crawlable.

Department colour and art support recognition but do not substitute for text
and links.

## Store SEO

Index a shop only when it has verified identity, a useful description, active
inventory, policies, and enough unique content. Avoid boilerplate city/shop
pages at scale. Store titles and descriptions must not claim “official” or
“authorized” without evidence.

## Image and visual search

- High-resolution primary product images without promotional text/watermarks.
- Descriptive filenames and accurate alt text.
- Variant image mapping.
- Multiple useful angles where available.
- Responsive sizes and modern formats.
- Product feed image parity.

Campaign creatives with baked text are marketing assets and should not replace
clean product images.

## Technical requirements

- Server rendering or deterministic prerendering for indexable routes.
- Correct status codes and canonical tags in initial HTML.
- Core Web Vitals budgets.
- No client-only metadata dependency for critical product information.
- Search Console, Merchant Center, sitemap, structured-data, and crawl-error
  monitoring.
- Robots configuration tied to the production canonical domain.

## Content architecture

Buying guides sit in hub-and-spoke clusters and link to products/categories
only when relevant. Refresh high-performing content quarterly. Keep commercial
facts such as price and stock live from catalog data rather than embedding
fragile values in editorial prose.

## SEO cautions

- Faceted crawl traps.
- Duplicate seller descriptions.
- Variant duplication.
- Search pages indexed as thin content.
- Expired campaign pages returning soft 404s.
- Marketplace UGC spam.
- Structured data that claims unavailable prices, ratings, or brands.
- Product pages reachable only through search forms.
