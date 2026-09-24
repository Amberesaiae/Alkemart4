# Taxonomy depth and category-specific listing forms

**Status:** planned · **Date:** 2026-09-24
**Supersedes nothing.** Executes the unbuilt half of
[`docs/architecture/catalog-taxonomy-and-discovery.md`](../docs/architecture/catalog-taxonomy-and-discovery.md)
and blueprint Phases 1A/1C/2B.

## The finding

The taxonomy *engine* is built and correct. The taxonomy *tree* is a stub, and a
second hardcoded tree in the header is papering over it.

Measured against production on 2026-09-24:

| | |
|---|---|
| Departments live | 12 |
| Second-level nodes live | 12 |
| **Total nodes / max depth** | **24 / 2** |
| Departments in the architecture doc | 17 |
| Attribute definitions published | 0 |
| Attribute profiles published | 0 |

What *is* correct, and must not be rebuilt:

- `categories` matches the doc's `TaxonomyNode` field for field — `code`,
  `displayName`, `slug`, `level`, `status`, `isBrowseable`, `isAssignable`,
  `isNavVisible`, `attributeProfileId`, `replacementNodeId`, `sortOrder`,
  `version`. Every flag is read by real code (11–27 references each).
- Descendant rollup works: `category=fashion-apparel` returns products filed
  under `men` and `women` (`descendantIds`, catalog-repository).
- Unknown handles fail closed — 0 results, never the unfiltered catalogue.
- `status` is enforced; deprecated nodes drop out of reads.
- Admin can create, patch and deprecate nodes (`taxonomy-board.tsx`,
  `POST/PATCH/POST :id/deprecate` on `/admin/taxonomy`).
- Typed attributes exist end to end: `attribute_definitions`,
  `attribute_profiles`, `profile_attributes`, `product_attribute_values`,
  `PUT /vendor/products/:id/attributes`, `GET /store/catalog/facets` with
  server counts, `/store/search?filter=code:v`, and the storefront facet UI.

## Problem 1 — the tree is two levels deep

The doc's worked example is four levels:

```
Industrial & Safety › PPE › Protective Clothing › Reflective Safety Jackets
```

Production has no third level anywhere. Whole departments the doc names are
absent: Industrial & Safety, Construction & Building, Business Equipment,
Sports & Leisure, Property, Jobs & Careers, Wholesale & Bulk. That is precisely
the Jiji breadth the doc praises, and it is the part that is missing.

## Problem 2 — there are two taxonomies, and the header owns the wrong one

`apps/storefront/src/lib/mega-taxonomy.ts` is a hardcoded 679-line tree driving
`HeaderCategoryNav` and `HeaderCategoryDropdown`. It is not derived from the
database and cannot be edited by an admin.

| | |
|---|---|
| Departments covered | 7 of 12 |
| Section headings | 56 |
| Items linking a real category | 115 |
| **Items that run a text search instead** | **84 (42%)** |
| **Referenced handles that do not exist** | **7 of 23** |

Missing handles: `baby`, `cosmetics`, `decor`, `fragrance`, `kitchen`,
`skincare`, `storage`. Each is a nav item that lands on an empty page — no
error, because unknown handles fail closed.

The 42% is the deeper problem. "Basic Phones" is not a node; it is
`?q=Basic phones`. It matches only if a seller happened to type those words, it
has no attribute profile, no counts, no SEO value, and it silently changes
meaning as the catalogue grows. The header promises a depth the catalogue does
not have.

## Problem 3 — nothing ever asks a seller for attributes

This is why facets are empty, and it is the single most important item here.

`attributeProfileId` is never read by `apps/api/src/routes/vendor/products.ts`.
Creating a product takes title, description, category, price, stock, image —
and never the category's attributes. Filling them is a separate, optional
`PUT /:id/attributes` that the vendor UI does not surface.

**This is the actual Jiji lesson, and the doc only half states it.** Jiji's
filters work because the category *is* the posting form: choosing "Laptops"
changes which fields you must complete before you can post. The attribute
profile is not metadata attached to a category — it is the listing form for
that category. Optional structured data does not get filled in, on any
marketplace, ever.

There is also no admin UI for attributes: `_authenticated/` has
`categories.tsx` and `taxonomy-board.tsx` but no attributes page, so
definitions and profiles can only be created by raw API calls today.

## Plan

Ordered by dependency. Each slice is shippable alone.

### T1 — Admin attributes console

Nothing else can proceed without a way to author definitions and profiles.

- New `_authenticated/attributes.tsx`: CRUD for definitions (code, label, type,
  unit family, allowed values, filterable/searchable/required, card/PDP
  visibility) and for profiles (name, category, ordered definitions with
  per-profile `required` override).
- Backed by the existing `/admin/attributes` routes — API work is already done.
- Guard: a definition in use by any product value cannot be deleted, only
  retired.

### T2 — Deepen the tree to level 3, evidence-led

- Add the seven missing departments from the doc, as `proposed` first.
- Take each department to level 3 only where the doc's eight deepening tests
  pass. **Phones & Electronics first**, because it is the category with real
  attribute structure and the one buyers filter hardest.
- Level 4 stays internal (`isBrowseable: false`) until a node earns a landing
  page — the doc's classification-is-not-navigation rule.
- Deprecate rather than delete; `replacementNodeId` already exists and is read.

### T3 — Delete `mega-taxonomy.ts`; derive the header from the tree

- Header nav renders from `/store/categories`, honouring `isNavVisible`,
  `displayName` and `sortOrder` — one taxonomy, admin-editable, never drifting.
- The 84 `searchQuery` pseudo-nodes are the decision point: each is either
  **promoted to a real node** (if it passes the deepening tests) or **dropped**.
  None survives as a fake category.
- Section headings become real grouping nodes with `isAssignable: false` — the
  doc already anticipates grouping nodes.
- Ship behind a flag, with a redirect map for any handle that changes.

### T4 — Category-specific listing forms (the Jiji mechanic)

- Product create/update resolves the category's `attributeProfileId` and
  returns its definitions, so the vendor form renders the right fields for the
  chosen category and re-renders when it changes.
- Profile-level `required` is enforced at **publish**, not at draft: a seller
  must be able to save a half-finished listing on a bad connection.
- The AI suggestion endpoint (`POST /:id/attributes/suggest`) pre-fills the
  form as an editable draft, which is what makes required fields tolerable on a
  phone.
- Backfill: existing products keep their free-text `products.attributes` and
  are never blocked; an admin migration maps common labels onto definitions
  where the mapping is unambiguous, and leaves the rest for review.

### T5 — Retire free-text attributes as a filter source

- `products.attributes` becomes display-only and input-only, exactly as the
  attribute-definitions schema comment already states.
- Facets and comparison read `product_attribute_values` only — already true in
  code; this slice is deleting the last write paths that pretend otherwise.

## Sequencing note

T1 → T2 → T4 delivers visible filters. T3 is independent and can land in
parallel. T5 is cleanup and should wait until T4 has run for a full catalogue
cycle.

## Unconstructive flags

- Deepening the tree uniformly instead of where evidence supports it.
- Keeping any `searchQuery` pseudo-category "for now".
- Making attributes required at draft rather than at publish.
- Seeding attribute *values* for existing products to make facets look
  populated — that is fabricated catalogue data.
