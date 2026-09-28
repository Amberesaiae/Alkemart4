# Shop-cover delivery — 2026-09-28

## Revised direction — these files supersede the studio versions

Owner rejected the coloured studio product spreads. Replaced all six covers
with generated, photographic-style retail interiors: practical counters and
stocked shelves, natural entrance light, neutral materials and modest wear.
These are **illustrative generated interiors**, not photographs or evidence of
the named sellers' actual premises. Obtain seller approval or actual shop photos
before representing them as their physical stores. No loose local produce.

Six covers generated with the built-in image-generation tool, visually reviewed,
then resized/cropped and encoded using ImageMagick: 1600×500, opaque WebP,
quality 82, metadata stripped. All are below 250 KB. No application code,
database records, uploads, or seller attachments were changed.

Paths below are relative to apps/storefront-v2/public/:

| File | Bytes |
| --- | ---: |
| images/shops/hurry-ventures-cover.webp | 107744 |
| images/shops/seller-b-cover.webp | 102466 |
| images/shops/demo-osu-electronics-cover.webp | 108194 |
| images/shops/demo-kumasi-fabrics-cover.webp | 166630 |
| images/shops/demo-takoradi-home-cover.webp | 146040 |
| images/shops/demo-tamale-grocers-cover.webp | 157660 |

## Prompt set

Shared brief: photorealistic-natural, ultrawide 16:5 retail interior seen from
the doorway at eye level, mild 35mm perspective and straight architecture.
Ordinary independent shop, natural daylight and existing ceiling lights,
neutral white balance, realistic reflections, varied inventory and believable
wear. Neither shabby nor fancy; no glossy CGI, perfect symmetry, floating goods,
studio-colour backdrop or cinematic lighting. No people, faces, readable signs,
price tags, logos, brand marks, watermarks or flags. Continuous space, not montage.

- Hurry Ventures: leather jackets on a rail, sandals on shelves, wooden counter.
- Kumasi Tech: phones in a glass counter, accessory boxes on practical shelves.
- Osu Electronics: headphones on hooks, speakers on shelves, phones in a counter.
- Kumasi Fabrics: patterned fabric bolts in racks, folded lengths on the counter.
- Takoradi Home: cookware and storage baskets on everyday shelves, a small plant.
- Tamale Grocers: packaged pantry staples, jars, oil and grain bags in stocked
  aisles; no fresh-produce spread, farm scene or market stall.

## Claude next steps / concerns

Upload each image and attach it to the matching seller banner per SHOP-COVERS.md.
No covers were created for suspended/terminated shops. Verify actual shop-page,
card and phone crops after attachment: interiors deliberately fill the frame,
and peripheral shelving is expected to crop while the central shop-category
display remains recognizable. The backgrounds are image-only; white UI text
still needs the existing scrim over bright window/wall surfaces. Do not assume white-text contrast from the
raw image alone. No live storefront preview was performed because these files
are not attached to sellers yet; Claude owns that integration step.
