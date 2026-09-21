# 02 — Taxonomy and catalog

## Separate organization systems

Alkemart must not overload one category tree.

| System | Owner | Job |
|---|---|---|
| Classification taxonomy | Platform | Define what a product is and govern data requirements |
| Navigation taxonomy | Platform | Present understandable buyer paths |
| Attribute profiles | Platform | Define comparable facts and filters by product type |
| Vendor collections | Seller | Organize one storefront in the seller's language |
| Search vocabulary | Platform + reviewed seller language | Match formal, informal, local, and model terminology |
| Campaign placements | Admin | Promote without changing classification |

## Launch departments

1. Phones & Tablets
2. Computing
3. Electronics
4. Home & Appliances
5. Fashion
6. Beauty & Personal Care
7. Groceries & Household
8. Baby & Kids
9. Sports & Fitness
10. Automotive Accessories
11. Agriculture Supplies
12. Tools, Industrial & Safety
13. Pet Care

Department expansion must follow catalog and search evidence, not symmetry.

## Taxonomy node contract

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

Never hard-delete an in-use category. Deprecate and redirect it.

## Product identity confidence

Branded goods remain the intended merchandise. Formal identifiers improve
matching but are not universally available at onboarding.

### Level A — Identified

- Confirmed brand and model.
- GTIN and/or manufacturer part number when available.
- Governed product type and attributes.
- Eligible for automatic or reviewed exact-product matching.

### Level B — Marketplace matched

- Brand/model and specifications strongly match an existing product.
- Matching is proposed by rules or similarity and confirmed by a seller/admin.
- Eligible for exact comparison after confirmation.

### Level C — Seller-specific branded listing

- Branded merchandise with insufficient evidence for canonical matching.
- Remains a standalone product associated with the seller.
- Can be bought normally but cannot claim exact-price comparison coverage.
- Enters an enrichment or duplicate-review queue.

This model avoids two opposite failures: excluding valid African retailers that
lack clean feeds, and falsely merging merely similar products.

## Core commerce model

```text
Product: stable identity and shared descriptive truth
  └── Variant: buyer-selectable variation
        └── Offer: seller-specific commercial terms
```

### Product fields

- Canonical title and slug.
- Brand and model/product family.
- GTIN, MPN, manufacturer when known.
- Product type and taxonomy path.
- Shared description and governed media.
- Typed specifications.
- Product identity confidence and provenance.

### Variant fields

- Stable variant ID and seller-independent option values.
- SKU/GTIN when available.
- Variation axes appropriate to the product type.
- Variant-specific image, dimensions, weight, and identifiers.

### Offer fields

- Seller and variant.
- Price and currency.
- Real compare-at price provenance.
- Condition.
- On-hand and reserved stock.
- Fulfillment origin.
- Delivery/pickup eligibility and service promise.
- Warranty and returns reference.
- Publication and freshness state.

## Typed attributes

Attribute definitions require type, units, allowed values, filterability,
searchability, card/PDP visibility, requiredness, and variant-axis eligibility.

```ts
type AttributeDefinition = {
  id: string
  code: string
  label: string
  type: "text" | "number" | "boolean" | "option" | "multi_option"
  unitFamily?: string
  allowedUnitIds?: string[]
  filterable: boolean
  searchable: boolean
  required: boolean
  variantAxis: boolean
  visibleOnCard: boolean
  visibleOnPdp: boolean
}
```

Free-form attributes remain a migration/input layer, not the long-term source
of facets.

## Category deepening rule

Create a subcategory when it represents stable buyer intent, supports enough
active supply, requires materially different attributes, and sellers can assign
it consistently. Brand, colour, size, material, season, and campaigns normally
remain attributes, filters, or collections.

## Department themes

```ts
type DepartmentTheme = {
  departmentId: string
  accent: string
  accentSoft: string
  accentInk: string
  icon: string
  heroArt?: string
  defaultAttributeProfileId?: string
}
```

Top-level departments have stable colour families. Descendants inherit. Colour
is strongest in navigation, hero art, filter headings, and selected controls;
product cards remain neutral. All combinations must pass contrast requirements.

## Vendor collections

Collections are seller-owned merchandising units, many-to-many with products,
and never alter canonical classification.

Examples: “Student phones,” “Weekend edit,” “Phones with warranty,” and “New
season dresses.” They need draft/published visibility, ordering, art, and
optional scheduling.

## Governance queues

- Products assigned to Other.
- Missing brand/model for product types that normally have them.
- Suspected duplicates.
- Conflicting identifiers.
- High-volume search queries without a taxonomy or alias match.
- Seller terms frequently used across shops.
- Attribute values that fail normalization.
- Categories with too little or too much active supply.
