# Phase 3 — Homepage course refinement

## Outcome

The buyer-facing homepage is now a guarded merchandising course instead of a direct rendering of every published Studio section.

1. Category mosaic
2. One product decision area: a published deal rail or the featured shelf
3. One campaign message
4. One behaviour-backed proof shelf
5. Store rail
6. Delivery trust and seller-acquisition bands
7. Footer

The category reel, editorial promo grid, adjacent campaign bands, and unmanaged leftovers no longer enter the public course. Studio data is preserved; the storefront composition function decides which section fills each public beat.

When the live catalogue cannot supply four distinct products, that shelf collapses honestly rather than repeating or inventing products.

## Visual review

- `after/home-390.png`
- `after/home-768.png`
- `after/home-1280.png`
- `after/home-1440.png`

Reviewed at 390, 768, 1280, and 1440 pixels with zero document-level horizontal overflow. The mobile full page reduced from approximately 4,443px before this phase to 2,008px in the sparse-catalogue state.

## Validation

- Storefront TypeScript check: passed.
- Storefront tests: 123 passed.
- Homepage course tests: 13 passed.
- Storefront production build: passed.
- `git diff --check`: passed.

Existing Medusa sourcemap and Vite chunking warnings remain unchanged.
