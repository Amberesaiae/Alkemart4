# Blueprint Phase 1 — Catalog identity and taxonomy

**Roadmap ref:** roadmap Phase 1. **Requires:** Phase 0 ADRs 001–003 accepted.
**Lifecycle owner:** vendor (publish/enrich/match) + admin (review/merge).

## Goal

A seller can publish a branded phone without a barcode, enrich structured
attributes, and safely match it to a canonical product through review.

## Slices (in order — each is backend-first per AGENT-PLAYBOOK Step B→C)

### 1A. Taxonomy lifecycle

- DB: extend `packages/db/src/schema/categories.ts` — `code`, `displayName`,
  `slug`, `level`, `status` (`proposed|active|deprecated`), `isBrowseable`,
  `isAssignable`, `isNavVisible`, `attributeProfileId`, `replacementNodeId`,
  `sortOrder`, `version`. Migration via `bun run --filter @alkemart/db generate`.
- Domain: `packages/domain/src/taxonomy.ts` — deprecate-and-redirect rule
  (never hard-delete in-use node), assignable vs browseable validation.
- API: `apps/api/src/routes/admin/` — taxonomy CRUD + deprecate/redirect;
  `apps/api/src/routes/store/categories.ts` — serve only `active` browseable
  nodes; redirect map for deprecated slugs (301 with replacement).
- UI: admin taxonomy screen (new route under `apps/backend/apps/admin`);
  vendor publish flow filters to assignable nodes only.
- Analytics: `category_viewed` with node id + version.
- Tests: domain rule tests + admin route tests + redirect test.

### 1B. Product identity + confidence

- DB: extend `packages/db/src/schema/products.ts` — `brand`, `model`,
  `gtin`, `mpn`, `manufacturer`, `productType`, `identityConfidence`
  (`identified|matched|seller_specific`), `identityProvenance` JSON.
  Extend `productVariants` — variant-specific image, dimensions, weight,
  identifiers; uniqueness index per governed axes.
- Domain: `packages/domain/src/catalog.ts` — confidence transition rules
  (only review can promote to `matched`; `seller_specific` never shows peer offers).
- API: vendor publish accepts brand/model without GTIN (Level C default);
  admin match-review queue endpoints.
- UI: vendor publish form (progressive: minimum to publish honestly, enrich later);
  admin match-review queue; PDP hides comparison language for Level C.
- Tests: confidence-transition tests; isolation tests (vendor cannot touch
  another seller's identity fields).

### 1C. Typed attributes + Phones profile

- DB: new tables in `packages/db/src/schema/` — `attribute_definitions`
  (code/label/type/unit/filterable/searchable/required/variantAxis/
  visibleOnCard/visibleOnPdp), `attribute_profiles`, typed
  `product_attribute_values`. Keep legacy `attributes` JSON read-only as
  migration layer (do not delete in this phase).
- Domain: normalization/validation per type + unit family.
- API: definitions CRUD (admin), values write path (vendor), read path
  returns typed values with definition refs.
- UI: vendor attribute editor driven by profile; Phones profile complete
  (brand, model family, storage, RAM, network, condition).
- Tests: validation tests per type; legacy-JSON fallback test.

### 1D. Product-match workflow

- DB: `product_match_candidates` (product pair, rule/similarity source,
  confidence, status, reviewer, history).
- API: candidate proposal (rules worker) + admin/seller confirm/reject;
  merge history immutable.
- UI: admin review queue; vendor "match suggestion" card with accept/decline.
- Analytics: `product_draft/publish/reject/enrich/match` seller-ops events.

### 1E. Department themes to shared source

- Move theme data from frontend metadata into `@alkemart/shared` + API source
  (`packages/shared/src/` theme module with accent/accentSoft/accentInk/icon,
  contrast validation); storefront `lib/category-theme.ts` becomes a consumer.
- Tests: contrast-requirement test per department.

## Migration / rollback

- Backfill current categories into versioned `active` nodes; map free-form
  attributes to validated fields only; **no auto-merge of existing products**.
- Rollback: migrations reversible; deprecated nodes restore to `active`;
  legacy JSON reader retained until typed coverage complete.

## Acceptance

 Seller publishes barcode-less branded phone → enriches attributes → match
 reviewed → peer comparison appears (Phase 3 consumer) or stays standalone
 with enrichment queue entry.

## Unconstructive flags

- Mandatory GTIN at onboarding; auto-merge on similarity; deleting categories
  in use; facets reading legacy JSON (Phase 2 must use typed values only);
  brand/colour/size as subcategories (attributes/filters/collections instead).
