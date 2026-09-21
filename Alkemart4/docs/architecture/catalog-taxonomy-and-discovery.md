# Catalog Taxonomy, Vendor Collections, PDP Data, and Search

**Status:** Proposed architecture — implementation guide

**Date:** 2026-09-18

**Scope:** Marketplace classification, vendor storefront organization, product detail pages (PDPs), discovery/search, merchandising, moderation, and future Meilisearch integration.

## Executive decision

Alkemart will not use one category tree to represent every kind of product organization.

The platform will separate:

1. **Marketplace classification** — what a product is.
2. **Marketplace navigation** — how shoppers browse.
3. **Vendor collections** — how a seller organizes their own storefront.
4. **Product types and attributes** — structured facts needed to compare and purchase an item.
5. **Search vocabulary** — words shoppers and vendors use to find it.
6. **Merchandising placements** — why a product or store is promoted.

The relational catalog remains the source of truth. Search is a denormalized, permission-aware projection. Vendor-created language is preserved and searchable, but it does not silently change canonical taxonomy.

This combines Jiji-style breadth and seller freedom with structured commerce data, real offers, delivery, checkout, vendor storefronts, and trustworthy search.

## Why this is necessary

Alkemart is a multi-vendor marketplace, not a single-retailer catalog. One vendor may sell PPE, construction supplies, food, services, or highly specialized goods that do not fit a small fixed list of departments.

The current model has a single `products.primaryCategoryId` and free-form JSON attributes. That is a useful starting point, but it creates long-term problems:

- vendors are forced to misclassify products;
- one category field is overloaded as navigation, classification, and search;
- arbitrary attributes cannot reliably become filters or facets;
- PDPs cannot consistently render comparable specifications;
- vendor storefront collections cannot be represented independently;
- taxonomy changes risk orphaning products and URLs;
- search quality depends too heavily on titles and descriptions.

Jiji demonstrates the value of broad coverage, seller language, location, condition, category-specific fields, and moderation. Its Ghana marketplace includes specialist areas such as Repair & Construction, Commercial Equipment & Tools, Business & Industry, Services, Food/Agriculture, and more. That breadth is valuable for Alkemart. However, Jiji is primarily listing-centric; Alkemart should add normalized product identity, seller offers, inventory, delivery, structured PDP data, and checkout.

## Design principles

### Classification is not navigation

An internal classification may be deeper and more precise than public navigation.

```
Internal:
Industrial & Safety › Personal Protective Equipment › Protective Clothing › Reflective Safety Jackets

Visible:
Industrial & Safety › PPE
```

### Categories describe product type

Use categories for durable distinctions in what the product is:

```
Phones
Laptops
Safety Helmets
Prepared Meals
Cleaning Services
```

Do not create permanent categories for every variation:

```
Black Phones
256GB Phones
Waterproof Helmets
New Arrivals
```

Those should generally be attributes, filters, collections, or campaigns.

### Attributes describe product characteristics

Attributes describe what a product is like:

```
Brand: 3M
Color: Yellow
Size: XL
Material: Polyester
Certification: EN 397
Use: Construction
```

### Vendor language must survive normalization

If a vendor enters `PPEs`, the platform can normalize it to `PPE` and map it to `Personal Protective Equipment`, but the vendor's wording remains searchable and can remain visible in the storefront.

### Deepening is evidence-driven

Do not expand the taxonomy uniformly. A new node must solve a proven navigation, classification, search, or data-quality problem.

### Search never replaces structure

Meilisearch can retrieve and rank denormalized documents. It must not become the authority for category membership, pricing, availability, seller permissions, or product publication.

## The taxonomy stack

### Marketplace classification taxonomy

This is the platform-controlled tree used for classification, reporting, external mappings, and broad discovery.

Recommended initial department set:

```
Phones & Electronics
Home & Appliances
Fashion & Apparel
Beauty & Personal Care
Food & Groceries
Health & Wellness
Baby & Kids
Automotive
Agriculture & Farming
Industrial & Safety
Construction & Building
Business Equipment
Sports & Leisure
Pets & Animals
Property
Jobs & Careers
Services
Wholesale & Bulk
Other
```

`Other` is a temporary intake safety net, not a successful final destination. Its products and search terms must be reviewed periodically for taxonomy proposals.

### Marketplace navigation taxonomy

This is the shopper-facing subset of the classification tree. It may use friendlier labels, hide internal levels, and promote high-value departments.

Each node needs independent flags:

```ts
type TaxonomyNode = {
  id: string
  parentId?: string
  code: string
  canonicalName: string
  displayName: string
  slug: string
  level: number
  status: "proposed" | "active" | "deprecated"
  isBrowseable: boolean
  isAssignable: boolean
  isNavVisible: boolean
  attributeProfileId?: string
  replacementNodeId?: string
  sortOrder: number
  version: number
}
```

### Vendor collections

Vendor collections are flexible storefront navigation. They are not canonical taxonomy nodes.

```ts
type VendorCollection = {
  id: string
  sellerId: string
  name: string
  slug: string
  description?: string
  imageUrl?: string
  visibility: "draft" | "published" | "hidden"
  sortOrder: number
  isFeatured: boolean
}
```

Products relate to collections through a many-to-many join table:

```
vendor_collection_products
- collection_id
- product_id
- sort_order
```

Example:

```
Marketplace classification: Industrial & Safety › PPE
Vendor collections: PPE, Safety Helmets, Reflective Jackets, Bulk Orders, New Arrivals
```

A product may belong to several vendor collections without changing its canonical classification.

### Product tags and search vocabulary

Tags support flexible discovery and should have provenance:

```ts
type ProductTag = {
  id: string
  label: string
  normalizedLabel: string
  source: "vendor" | "admin" | "system"
  moderationStatus: "pending" | "approved" | "rejected"
}
```

Search aliases and synonyms are governed separately:

```
PPE ↔ personal protective equipment
PPEs ↔ PPE
hard hat ↔ safety helmet
fridge ↔ refrigerator
phone ↔ mobile phone
jollof ↔ jollof rice
```

Vendor tags should not automatically become global synonyms.

## Rules for deepening taxonomy

Create a new category only when most of the following are true:

1. It represents a distinct shopper intent.
2. Shoppers use a stable, recognizable name for it.
3. It has enough active products to browse.
4. It needs a materially different attribute profile.
5. It needs different merchandising or content.
6. Vendors can classify products into it consistently.
7. It will remain meaningful over time.
8. It has measurable search or navigation demand.

Do not create a category when the difference is primarily color, size, material, brand, price, condition, audience, season, campaign, or a use case crossing several product types. Those belong in attributes, filters, tags, collections, or campaigns.

### Evidence thresholds

These are operating heuristics, not hard product laws:

```
0–4 active products: keep as a tag, collection, or search term
5–15 active products: candidate for a filter or vendor collection
15–30 active products: candidate for a browseable subcategory if demand exists
30+ active products: strong category candidate if buying intent is distinct
```

Use product count, active sellers, query volume, click-through, conversion, filter usage, and zero-result data together.

### Avoid mixed-level trees

Do not mix product type, brand, model, feature, and campaign:

```
Phones › Android › Samsung › Galaxy › S25 › Black
```

Prefer:

```
Category: Phones
Operating system: Android
Brand: Samsung
Product family: Galaxy
Model: S25
Color: Black
```

### Every leaf needs an attribute profile

Deepening is only valuable when it improves structured product data.

```
Leaf: Reflective Safety Jackets
Required: size, color, material
Recommended: visibility class, waterproof, intended use, certification
```

## Product and PDP model

The PDP must be generated from structured product data, not arbitrary vendor labels.

```
Product
  └── Variant
        └── Offer
              └── Seller / price / stock / delivery / condition
```

### Product

Stable identity and descriptive content: title, description, brand, product type, classification, media, and specifications.

### Variant

Purchasable variation axes: size, color, storage, capacity, or pack size.

### Offer

Seller-specific commercial data: seller, price, availability, stock, condition, delivery coverage, lead time, and return policy.

Do not duplicate product identity just because multiple sellers offer the same item.

### Typed attributes

The current free-form `{ label, value }[]` shape should be treated as a migration format. The target is a definition-backed value:

```ts
type ProductAttributeValue = {
  productId: string
  definitionId: string
  valueText?: string
  valueNumber?: number
  valueBoolean?: boolean
  valueOptionId?: string
  unit?: string
  normalizedValue?: string
}
```

An attribute definition specifies data type, unit, searchability, filterability, required status, variant-axis status, and PDP/card visibility.

Use standard properties for standard facts such as brand, color, dimensions, GTIN, SKU, and price. Use generic properties only when no standard field exists.

## Vendor and admin control

Vendors control storefront identity, collections, collection ordering, product titles/descriptions, vendor tags, product attributes within allowed schemas, featured products, announcements, layout presets, availability schedules, and collection visibility.

Vendors do not control canonical marketplace taxonomy, platform-wide search ranking, verified labels, regulated-product approval, global synonyms, or homepage promotion without eligibility/review.

Admin tools must manage taxonomy as a governed system:

- propose, approve, rename, merge, deprecate, and redirect nodes;
- define attribute profiles and allowed values;
- approve aliases and global synonyms;
- moderate vendor tags and regulated goods;
- review products assigned to `Other`;
- manage search redirects and promoted results;
- manage homepage and vendor merchandising placements;
- view zero-result and low-conversion queries;
- monitor index freshness and failed projection events.

Taxonomy lifecycle:

```
Proposed → Reviewed → Active → Deprecated → Redirected/Archived
```

Never hard-delete an in-use category. Preserve historical references and map old nodes to replacements.

## Search and future Meilisearch architecture

The relational database is authoritative. Meilisearch is a read projection:

```
Postgres transaction
        ↓
Transactional outbox event
        ↓
Projection worker
        ↓
Denormalized product document
        ↓
Meilisearch
        ↓
Search API
```

Do not create one Meilisearch index per vendor. Use shared indexes and enforce vendor-scoped access through the backend or short-lived tenant tokens. See [Meilisearch multi-tenancy](https://www.meilisearch.com/blog/multi-tenancy).

The product projection should include title, brand, description, taxonomy IDs/path, collection IDs/names, approved tags, normalized attributes, seller identity, price, availability, delivery eligibility, publication state, and ranking signals.

Recommended searchable fields:

```
title, brand, tags, collectionNames, taxonomyPath, sellerName, description, sku
```

Recommended filterable fields:

```
sellerId, taxonomyIds, collectionIds, tags, attributes.*, pricePesewas,
availability, deliveryAvailable, locationIds, rating
```

Start ranking deterministically:

```
exact title match
exact brand/product-type match
alias match
tag/collection match
seller match
description match
availability
popularity
rating
freshness
```

Marketing boosts must be explicit, time-bounded, and labeled as promoted. Relevance must not be overwhelmed by popularity.

Indexing events:

```ts
type CatalogChangedEvent = {
  aggregateType: "product" | "variant" | "offer" | "seller" | "taxonomy" | "collection"
  aggregateId: string
  eventType: "created" | "updated" | "published" | "unpublished" | "deleted" | "availability_changed"
  version: number
}
```

The projection worker rebuilds a document from the authoritative database. It does not trust a partial event payload to contain the full search record.

## Search facets and analytics

Do not expose every attribute as a facet. A facet should be normalized, understandable, sufficiently populated, relevant to the active category/query, useful for narrowing, and stable enough to maintain.

```
Phones: Brand, Storage, RAM, Condition, Price
PPE: Product type, Size, Material, Certification, Use, Condition
Food: Cuisine, Dietary preference, Spice level, Serving size, Availability
```

The backend should return facet metadata with labels, values, counts, and types. The frontend should not invent facets from arbitrary product JSON.

Track:

```
query submitted, zero-result query, result impression, result click,
filter selected, product viewed, add to cart, purchase, search abandoned,
category entered, vendor collection clicked
```

Use these signals to generate a taxonomy review queue:

```
high-volume zero-result query
frequently used vendor tag
category with too many products
category with too few products
high-use filter
products repeatedly assigned to Other
```

## Jiji-inspired marketplace behavior

Adopt Jiji's:

- broad marketplace coverage;
- seller-created titles and descriptions;
- category-specific listing forms;
- location and condition;
- moderation before publication;
- flexible services and specialist categories;
- saved searches and alerts.

Improve on the listing-centric model with:

- normalized product identity;
- product/variant/offer separation;
- vendor storefronts and collections;
- inventory and availability;
- delivery-aware search;
- structured PDP specifications;
- marketplace checkout;
- duplicate detection;
- stronger trust and moderation.

## Homepage and storefront merchandising

A product may appear in multiple discovery surfaces without changing classification:

```
Classification: PPE
Vendor collection: Bulk Orders
Search tag: safety gear
Homepage placement: Featured from Accra Safety Hub
Campaign: Construction Essentials
```

Homepage sections should support product shelves, store-product rails, store rails, category grids, promo grids, and deal rails. A store-product rail should show vendor identity explicitly:

```
[logo] Popular from Accra Safety Hub       View store
[product] [product] [product] [product]
```

Admin controls placement. Vendors can submit products or collections for consideration but should not turn the public homepage into an uncontrolled feed.

## SEO and URL rules

Use stable browseable taxonomy paths:

```
/categories/industrial-safety
/categories/industrial-safety/ppe
/products/reflective-safety-jacket
/shops/accra-safety-hub
```

Do not create indexable pages for every filter combination. Every product should be reachable through internal links from appropriate category, collection, vendor, or homepage surfaces.

Product pages should expose accurate structured Product/Offer data for identity, price, availability, seller, shipping, returns, reviews, and variants where available. See [Google Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product) and [Google Product variants](https://developers.google.com/search/blog/2024/02/product-variants).

## Moderation and compliance

Taxonomy is also a compliance system. Category-specific rules should exist for medicines and health claims, chemicals and agrochemicals, food and beverages, cosmetics, weapons and restricted goods, regulated equipment, financial services, and jobs/services.

Required attributes, moderation rules, and prohibited terms can be attached to product types or taxonomy nodes. Jiji's [posting rules](https://jiji.com.gh/faq/10) and [prohibited-items policy](https://jiji.com.gh/faq/14) are useful local-market references, not a substitute for Alkemart policy and Ghanaian legal review.

## Implementation sequence

### Phase 1 — Domain foundations

- preserve the current category table as marketplace taxonomy;
- add taxonomy aliases and lifecycle fields;
- add vendor collections and the product join table;
- add product tags with provenance;
- define product types and attribute definitions;
- keep current free-form attributes as migration format only.

### Phase 2 — PDP and catalog quality

- migrate common attributes into typed definitions;
- separate product, variant, and offer concerns;
- add category/product-type attribute profiles;
- add availability and condition to offers;
- add validation and moderation states.

### Phase 3 — Search projection

- add a transactional outbox;
- build a denormalized product projection;
- index published, eligible products only;
- introduce Meilisearch beside current search;
- compare result quality and latency;
- add facets, aliases, typo rules, and search analytics.

### Phase 4 — Vendor and admin workflows

- build vendor collection management;
- add vendor product-type forms;
- add taxonomy governance tools;
- add synonym and alias review;
- add search-quality dashboards;
- add homepage store-product placements.

### Phase 5 — Optimization

- location-aware ranking;
- delivery-aware availability;
- seller and product recommendations;
- saved searches and alerts;
- personalization only after sufficient behavioral data exists.

## Success criteria

The architecture is working when:

- a PPE vendor can classify products accurately without inventing a marketplace department;
- the vendor can create collections in their own language;
- shoppers can find items by formal or informal terms;
- PDPs show consistent, comparable specifications;
- category-aware facets are useful;
- multiple sellers can offer the same normalized product;
- admin can merge, deprecate, and redirect taxonomy safely;
- homepage merchandising can feature stores and products independently of taxonomy;
- search can migrate to Meilisearch without changing the domain model;
- taxonomy decisions are driven by catalog and query evidence.

## References

- [GS1: How GPC works](https://www.gs1.org/standards/gpc/how-gpc-works)
- [GS1: GPC Development and Implementation Guide](https://www.gs1.org/docs/gpc/GPC_Development_Implementation.pdf)
- [Google Merchant Center: Google product category](https://support.google.com/merchants/answer/6324436)
- [Google Search Central: Ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure)
- [Baymard: Homepage and category navigation UX](https://baymard.com/research/homepage-and-category-usability)
- [Baymard: Ecommerce category pages](https://baymard.com/learn/ecommerce-category-page)
- [Jiji Ghana](https://jiji.com.gh/)
- [Jiji Ghana: How to sell](https://jiji.com.gh/faq/8)
- [Meilisearch: Multi-tenancy](https://www.meilisearch.com/blog/multi-tenancy)
