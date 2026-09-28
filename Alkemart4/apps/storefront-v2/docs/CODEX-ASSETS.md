# Storefront v2 — visual asset brief (for Codex)

The storefront code is complete. Every image below is **already wired in** at a
fixed path, with a graceful fallback while the file is missing. Your job is to
create the files at exactly these paths. **Do not edit any `.ts`, `.tsx`,
`.css` or `.json` source** — if a path or size seems wrong, write it down in
`docs/CODEX-NOTES.md` instead of changing code.

App root: `Alkemart4/apps/storefront-v2/` · all paths below are under `public/`.
Preview: `bun run --cwd Alkemart4/apps/storefront-v2 dev` → http://localhost:5176
(needs the Workers API on :8787 — see `docs/architecture/workers/LOCAL-DEV.md`).
Visual references: `Alkemart4/alkedesign/*.png` (the approved mockups).

## Brand system (read first)

- Wordmark is **live text** ("alkemart", Figtree ExtraBold, tracking −0.045em).
  You draw the **mark only** — never bake the word into the mark files.
- Mark: a pinwheel of four rounded petals + one small dot, as in the mockups.
  Petal colours: coral `#FF5A36`, gold `#FEBF31`, teal `#12B886`, blue `#3B5BFF`;
  dot violet `#7A3BFF`. Brand gold for CTAs/backgrounds is `#FEBF31`.
- Ink `#111114` (text), soft ink `#1D1D24` (desktop home header, dark bands),
  page white `#FFFFFF`, neutral surface `#F6F6F7`.
- Department tile grounds (the colour each cut-out will sit on):
  electronics `#121216` · fashion `#7C4DFF` · home `#F7B04A` · beauty `#FF8A80` ·
  gaming `#2F5BFF` · appliances `#5AD6A8` · baby `#FFD95A` · food `#1B7F45` ·
  health `#7CB8FF` · pets `#FFB679` · sports `#FF7A45` · auto `#3F4652` ·
  books `#3F6FE0` · default `#E9E9EC`.
- Style: bright, clean, premium studio product photography — like the mockups.
  Soft realistic shadows. **No text, no logos of real brands, no watermarks,
  no people's faces unless stated.** Africa-first but not country-specific
  (the platform will serve several African markets).

## 1 · Logo & loading (`public/brand/`, `public/`)

| File | Spec |
|---|---|
| `brand/alkemart-mark.png` | Transparent raster brand mark: four colored petals plus the offset dark dot. Used for loading states. |
| `brand/alkemart-logo-primary.png` + `brand/alkemart-logo-light.png` | Transparent raster logo lockups with dark and white wordmarks for light and dark surfaces. |
| `icons/icon-512.png` | Square yellow raster app icon for browser and PWA surfaces. |
| `brand/og.png` | 1200×630 social share card: gold `#FEBF31` ground, the mark, "alkemart" and "Many sellers. More choices. Better prices." Keep text inside a 1080×520 safe area. |
| `icons/icon-192.png`, `icons/icon-512.png` | App icons (PWA). Mark centred on white, 12% padding. |
| `screenshots/home-mobile.png` | 390×844 PNG screenshot of the mobile home page, used in the "Install app" prompt (the manifest points here). A real capture of the running app, not drawn art. Recapture after the home page changes: `google-chrome-stable --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=390,844 --virtual-time-budget=12000 --screenshot=public/screenshots/home-mobile.png <storefront URL>`. |
| `icons/icon-maskable-512.png` | Maskable: mark within the central 80% safe zone on a gold `#FEBF31` full-bleed square. |

## 2 · Department tile art (`public/images/departments/{id}.webp`)

**Format (what's in use now):** an opaque **scene**, WebP, **900×1125 (4:5)**,
products on a styled set in the department's colour family — like the six
already delivered. The tile crops it with `object-cover`, **anchored to the
bottom**: on desktop the tile is near-square (20:21), so up to ~15% of the
**top** is cut off. Keep all products in the **bottom 70%**.

**Text safe zone:** the tile's bold title (1–2 lines) sits **top-left** over a
scrim, and a white round arrow sits **bottom-right** (44px, 16px inset). Keep
the **top 35%** calm (backdrop, wall, sky — no products, no busy detail) and
keep the bottom-right corner free of the key product.

**Phone department grid** (home page and Categories on phones) shows the
studio scenes `reference-{id}-v1.webp` (fashion: `-v2`) at **4:5, ~110px wide,
three across**, title top-left. Until a department has one it shows its colour
and icon. Needed next, same 900×1125 format and top-35% calm zone:
`reference-baby-v1`, `reference-food-v1`, `reference-health-v1`,
`reference-pets-v1`, `reference-auto-v1`; then add the id to `STUDIO` in
`src/components/commerce/department-grid.tsx`.

**Which ids are actually needed.** Tiles map the *real* catalogue departments
to an id (`src/lib/departments.ts`). Current departments and their art:

| Real department (handle) | id | Art |
|---|---|---|
| phones-electronics | `electronics` | ✅ delivered |
| fashion-apparel | `fashion` | ✅ delivered |
| home-living | `home` | ✅ delivered |
| health-beauty | `beauty` | ✅ delivered |
| food-groceries, beverages, agriculture | `food` | **needed** — fresh produce, pantry staples, drinks |
| pet-care | `pets` | **needed** — pet food, bowl, toys, a dog or cat is fine |
| baby-kids | `baby` | **needed** — nappies, bottle, toys, kids' clothes |
| automotive | `auto` | **needed** — car care, tyre, tools |
| services, other | `default` | **needed** — neutral mixed-goods scene |
| — | `gaming`, `appliances` | delivered, but no current department uses them (kept for later) |

Until a file exists the tile falls back to the older shared category photo,
then to an icon — so partial delivery is safe. ≤ 180 KB each.

## 3 · Hero, home bands & page art (`public/images/`)

The home page is: dark header (desktop) / gold header (phone) → **full-bleed
gold `#FEBF31` hero** → white panel that overlaps the hero's bottom edge by
40px → category row → shelves and bands. Art is **image-only**; any lettering
that belongs *in the picture* (like the handwritten notes) is part of the image.

| File | Spec |
|---|---|
| `hero/home.webp` | **The home hero art.** Transparent WebP, 1600×1200, placed on the gold ground, anchored to the **right edge**, filling the hero's full height and the **right 52%** of its width (`object-contain`, right-aligned). Desktop ≥1024px; **phones also show it** (right 54% of the hero beside the headline, ~200px wide, `object-contain`). Content: a joyful floating collage of products (headphones, phone, sneaker, perfume, handbag, skincare) over abstract coral/violet/teal/blue **petal shapes** from the mark, plus three short **handwritten notes with little arrows**: "More choices", "Better prices", "Trusted sellers" (ink `#111114`, marker style, legible at 60% scale). Rules: the **left 12% of the canvas is empty** (it meets the headline column), nothing important in the **bottom 10%** (the white panel overlaps it), the petals may bleed off the right and top edges. No gold background baked in — it must be transparent so the hero's gold shows through. |
| `hero/phone-01.webp`, `hero/phone-02.webp`, … | **Phone hero slides** (after `hero/home.webp`, which is slide 1). Transparent WebP, **1600×1200 (4:3)**, same style as `home.webp`: floating products over the mark's petal shapes, on no background (the hero's gold shows through). Shown ~200px wide on a 375px phone, bleeding off the right edge, so: **one to three large products per slide**, not a crowd; any handwritten note ≤3 words and drawn **at least 3× the desktop size** so it reads at 200px; left 12% empty. Themes to cover, one per slide: phones and gadgets; fashion (sneaker, bag); home (chair, plant, cookware); beauty (perfume, skincare); groceries and everyday goods. List each new file in `PHONE_HERO_ART` (`src/components/home/home-hero.tsx`) — two or more swipe automatically. |
| `promos/spotlight.webp` | **Store spotlight backdrop.** 1800×800 WebP, **opaque**, shown `object-cover` behind a dark ink card at **35% opacity**, with white text on the left third and product thumbnails on the right. Content: an atmospheric, softly out-of-focus market-stall / boutique interior (warm light, shelves of goods, no faces, no readable signage). Keep it low-contrast and mostly mid/dark tones so white text stays readable. Used only when a shop has no banner of its own. |
| `hero/sell.webp` | **Sell band art.** 1200×900 WebP, opaque, `object-cover` on the **right half** of a dark ink `#1D1D24` rounded band (≥768px), cropped from its left edge. Content: a small-business owner's hands packing an order, with a phone showing an order notification (no readable text). No face. Fade the **left 25%** into `#1D1D24` so it blends into the band. |
| `hero/stores.webp` | Shops page hero right-hand art on gold, transparent 1400×700: bag, sneakers, headphones, perfume, plant. Left 50% empty. |
| `auth/buyer.webp` | Sign-in side panel, 1200×1600 (portrait, `object-cover`): warm lifestyle photo of a shopper receiving a delivery at their door. A card with copy overlays the **bottom 45%**, so keep the subject in the top half. |

Not image slots (don't make art for them): the trust panel under the hero,
"One product. More choices." (uses a real multi-seller product), the shop
cards in "Meet the people behind the products" (use each shop's own banner and
products), and studio promos / campaigns (creatives uploaded by admins).

## 4 · Spot illustrations (`public/illustrations/{name}.webp`)

Transparent WebP, 640×480, flat-vector style with the brand palette (gold,
ink, coral/violet/teal/blue accents), consistent line weight across the set,
no text. Rendered about 128–160px tall — keep shapes bold.

`not-found` (lost parcel) · `empty-cart` · `empty-orders` (empty box) ·
`empty-saved` (heart) · `no-results` (magnifier) · `empty-shelf` ·
`order-success` (parcel with check, confetti) · `help` · `delivery` (rider on
motorbike) · `about` (market stalls) · `support` (chat bubbles).

## 5 · Demo catalogue photos (`public/images/products/demo/*.jpg`)

The current demo product photos use mixed coloured studio backgrounds (beige,
black, peach), which fights the card design (cards blend pure white into a
neutral surface). **Re-shoot every existing file in that folder, keeping the
same filename and subject**: product centred on **pure white `#FFFFFF`**,
square 1200×1200 JPG, product filling ~75% of the frame, soft contact shadow,
≤ 150 KB. List the folder first; do not add or rename files.

## Acceptance checklist

- [ ] Every path above exists; none of the interim files remain.
- [ ] `bun run --cwd Alkemart4/apps/storefront-v2 build` still passes.
- [ ] Home desktop: hero art sits on the right half, never touches the
      headline or search box, notes legible, bottom not hidden by the panel.
- [ ] Home (desktop + 375px phone): category row tiles show cut-outs, no art
      overlaps a tile title, arrow button (bottom-right) stays clear.
- [ ] Store spotlight and Sell band: white text readable over the art.
- [ ] Stores, Sell, Help, Delivery, About, 404, empty cart show their art.
- [ ] Mark legible at 20px in the header; spinner animates on first load.
- [ ] No source files changed (`git status` shows only `public/**` and
      `docs/CODEX-NOTES.md`).

---

## Prompt to paste into Codex

> You are producing visual assets for the alkemart storefront (a multi-seller
> marketplace). The code is finished and already references every file.
> Read `Alkemart4/apps/storefront-v2/docs/CODEX-ASSETS.md` and the mockups in
> `Alkemart4/alkedesign/`. Create each asset at the exact path, size, format and
> composition rules listed there — especially the safe zones, which keep
> images from colliding with text: the home hero art lives on the right half
> of a gold hero (transparent, includes the handwritten "More choices / Better
> prices / Trusted sellers" notes), and department cut-outs sit along the
> bottom of tall 4:5 tiles with the title top-left and an arrow bottom-right.
> Work in this order: 1) logo mark, spinner, favicon, PWA icons, OG card;
> 2) the home hero art (`images/hero/home.webp`); 3) the missing department
> scenes (food, pets, baby, auto, default — see the table in §2); 4) the spotlight backdrop, sell band and other page art;
> 5) spot illustrations; 6) re-shoot the demo product photos on pure white
> keeping filenames. Do **not** modify any
> `.ts/.tsx/.css/.json` file — only add/replace files under
> `Alkemart4/apps/storefront-v2/public/` (and write questions to
> `Alkemart4/apps/storefront-v2/docs/CODEX-NOTES.md`). After each group, run the
> dev server, check the pages listed in the acceptance checklist at desktop and
> 375px widths, and fix the assets (not the code) until they pass.
