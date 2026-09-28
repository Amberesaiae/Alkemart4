# Canonical category art — mirror manifest

This dir is a **mirror** of the canonical curation in
`apps/storefront/public/images/categories/` (main tree). The lab ships
**webp only**; `*-source.jpg` masters and `*.pre-crop` backups live in the
main storefront and are never copied here.

## Canonical files (md5 @ sync 2026-09-19)

| File | Bytes | Dims | md5 |
|------|-------|------|-----|
| cosmetics.webp | 214412 | 1400x1400 | 3b5fc004366ada3cf09d426b1b988057 |
| electronics.webp | 133090 | 1400x1232 | 178f9e9768714689d983766789195eac |
| food.webp | 185172 | 764x1400 | 5d31672a87290694c53554635ccc50cc |
| pets.webp | 135268 | 933x1400 | 4d80619f79d295f697e1eaf8b7f2b636 |

`electronics.webp` is the watermark-cropped repair (bottom 12% removed,
see `apps/storefront/scripts/crop-watermark.mjs`). Never re-mirror the
`.pre-crop` originals.

## Rules

1. Every file here MUST be referenced by `CATEGORY_ART`
   (`packages/shared/src/category-art.ts`) — no orphans.
2. Every `CATEGORY_ART` photo MUST exist here — no dangling refs.
3. No `*-source.jpg`, no `*.pre-crop`, no non-webp in this dir.
4. Budget: each webp < 300KB (keeps mosaic + hero fast on mobile).
5. Re-mirror procedure: copy the webp from the main storefront dir,
   update the table above, run
   `bun run test -- src/lib/__tests__/category-art-manifest.test.ts`.

## Not yet mirrored (main-only curation, untracked there)

`fashion.jpg`, `mosaic-*.jpg`, `rail-*.jpg`, `promos/` — new art for the
main storefront's mosaic/rail components. Mirror into the lab only when
the lab adopts those surfaces (see CUTOVER gap #4, hero photography).
