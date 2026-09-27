# Images for Codex to create

Built from what the code actually references versus what exists in
`apps/storefront-v2/public/images` (checked 2026-09-26). The layout already
has a slot for each image and a fallback until it exists, so nothing is
blocked. Drop the file at the exact path below and it appears; no code change
is needed.

**House style** (match the existing `departments/*.webp`): real products on a
clean, softly lit set, no text or logos baked into the image, no people's
faces, products sitting in the lower half (tiles crop from the top). WebP,
under 120 KB each.

## 1. Department scenes (highest impact)

Used on the Categories page, Home department tiles and search suggestions.
Six exist; these seven show a coloured icon tile until they're made.

Format: **900 × 1125 px (4:5)**, WebP, path `/images/departments/{id}.webp`.

| File | Scene |
|---|---|
| `departments/food.webp` | Ghanaian staples: bag of rice, gari, cooking oil, tomato tins, plantain on a counter |
| `departments/baby.webp` | Baby essentials: nappies pack, feeding bottle, soft toy, small clothes folded |
| `departments/health.webp` | Pharmacy basics: vitamins, first-aid box, thermometer, hand sanitiser |
| `departments/pets.webp` | Pet food bag, bowl, leash, a chew toy |
| `departments/sports.webp` | Football, trainers, water bottle, skipping rope |
| `departments/auto.webp` | Car care: engine oil, tyre gauge, microfibre cloth, phone mount |
| `departments/books.webp` | School and office: exercise books, pens, calculator, backpack |

Beverages and Agriculture currently borrow the Food colour with their own
icons. If you want scenes for them too, add `departments/beverages.webp`
(drinks, sachet water, malt) and `departments/agriculture.webp` (seed packs,
cutlass, watering can), and I'll wire them in (it's a one-line change).

## 2. Referenced but missing (small)

| File | Where it shows | Format |
|---|---|---|
| `auth/buyer.webp` | Side art on the buyer sign-in page (desktop only) | 1200 × 1500 (4:5); a shopper's hands holding a phone with a parcel nearby |
| `hero/sell.webp` | The "Sell on alkemart" strip on Home and the Sell page | 1600 × 1000; a small shop counter with packed parcels ready for a rider |
| `promos/spotlight.webp` | Backdrop of the featured-shop card on Home, used when the shop has no cover photo | 1600 × 700; an inviting, generic shopfront or market-stall scene with no text |

## 3. Nice to have

- **Empty-state illustrations**: the code already asks for these five and
  shows an icon until they exist. Path `/illustrations/{name}.webp`, about
  480 × 360, simple spot illustration (ink + gold, lots of white):
  `empty-cart`, `empty-orders`, `empty-saved`, `empty-shelf`, `no-results`.
- **Default share image** at 1200 × 630 (`og/default.jpg`): shown when a
  link to the site is shared on WhatsApp, X or Facebook. The logo on gold
  with the tagline (text is fine here; it's a social card). Unlike the rest,
  this one needs a one-line hookup after it exists; tell me when it's in.

## Not needed from Codex

Product photos (sellers upload their own), shop logos and banners (sellers
upload), and icons (Hugeicons are in use everywhere).
