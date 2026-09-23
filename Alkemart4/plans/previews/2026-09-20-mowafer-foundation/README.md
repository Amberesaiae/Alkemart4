# MOWAFER foundation preview — Phase 0/1

## Status

- Baseline captured before token changes at 390, 768, 1280 and 1440px.
- Foundation specimen captured after token changes at the same widths.
- Home and store-route regression captures recorded after the change.
- Header/home/PDP composition intentionally unchanged; those belong to later phases.

## Implemented foundation

- Montserrat 400/500/600/700 is the single storefront family.
- Brand yellow is `#FEBF31`; primary ink/foreground is `#3C3C3B`.
- Muted surfaces now provide a quiet neutral layer instead of duplicating white cards.
- Commerce radii use a tighter 6/8/12/16/20/24px scale.
- Shadows use neutral MOWAFER ink rather than warm black.
- Captured department identity colours restored for electronics, food, home/pet, beverages and baby.
- Canonical spacing rhythm recorded as 8/16/24/32/48px.
- Storefront design spine no longer treats Hubtel/Hapto as normative visual sources.

## Visual review

- Montserrat remains readable at product-card and metadata sizes and gives headings a clearer retail voice.
- The `#3C3C3B` ink softens the previous pure-black contrast without weakening hierarchy.
- Tighter radii make commerce surfaces feel more deliberate; campaign imagery remains allowed to use larger radii.
- Department colours are intentionally bold in the specimen. Public pages should use them as wayfinding accents, not full-page surfaces.
- Homepage before/after confirms this phase does not reorder or remove content.
- Store route data was unstable in the local fixture (`hurry-ventures` returned not found; `seller-b` remained loading), so Phase 2 must repeat the store-page regression capture with a stable seller fixture before shell work is accepted.

## Validation

- Storefront typecheck: pass.
- Storefront tests: 10 files, 120 tests pass.
- Targeted foundation/contrast/no-cream tests: 3 files, 84 tests pass.
- Production build: pass.
- Browser console errors during foundation captures: none.
- Non-blocking warnings: upstream Medusa SDK sourcemaps reference missing source files during Vitest; existing build warning notes mixed static/dynamic analytics imports.

## Preview index

- `baseline/home-{390,768,1280,1440}.png`
- `baseline/plp-{390,768,1280,1440}.png`
- `baseline/pdp-{390,768,1280,1440}.png`
- `baseline/store-{390,768,1280,1440}.png`
- `baseline/home-{390,1280}-full.png`
- `after/foundation-{390,768,1280,1440}.png`
- `after/home-{390,768,1280,1440}.png`
- `after/store-{390,768,1280,1440}.png`

## Next gate

Review and accept the foundation specimen. Once accepted, proceed to Phase 2: header and context navigation only.
