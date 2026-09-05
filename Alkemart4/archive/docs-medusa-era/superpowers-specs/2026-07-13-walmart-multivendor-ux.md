# Alkemart4 marketplace UI/UX — research-backed visual hierarchy

**Date:** 2026-07-13  
**Scope:** Buyer storefront hierarchy (chrome, home, PLP, product tiles)  
**Sources:** Walmart 2025 brand refresh (True Blue + Spark Yellow); multi-vendor marketplace UX (trust, navigation, listing clarity); general ecommerce hierarchy (F-scan, price prominence)

## Research synthesis

### Walmart (2025 brand + digital retail)

1. **True Blue + Spark Yellow** — blue = primary chrome / trust; yellow = spark action and energy (search, badges, promos).
2. **Spark as beacon** — yellow controls guide the primary action path (search, claim, cart badge).
3. **Omnichannel one-stop** — pickup/delivery, departments, dense catalog, not boutique serif marketing.
4. **Approachable utilitarian type** — modern sans, high legibility, not editorial display as default.

### Multi-vendor marketplace UX

1. **Trust on every tile** — ratings, sold-by / brand, clear stock & delivery meta.
2. **2–3 click discovery** — departments → PLP → PDP; sticky filters on PLP.
3. **Unified catalog, per-vendor identity** — product grid is marketplace-wide; vendor line is secondary but visible.
4. **Compare-friendly listings** — consistent card structure so shoppers scan price/rating across columns.

### Visual hierarchy (implementation rules)

| Priority | Surface | Order of attention |
|---------|---------|-------------------|
| 1 | Global chrome | Logo → location → **search** → account → cart |
| 2 | PLP | Title + count → sort → facets (left) → product grid |
| 3 | Product card | Image + deal badge → **price** → title → rating → fulfillment → add |
| 4 | Home modules | Promo band → hero → white section cards with titled rails |

## Current gaps in Alkemart4

- PLP still uses generic US-centric filter labels ("Walmart Cash Offers", Apple pills).
- Category tiles use raw `<a href="#">` — not real routing.
- Product cards lack multi-vendor trust line (brand / sold-by).
- Results hierarchy: blue category hero is loud; should be quieter title + count + sort toolbar.
- Filter sidebar uses `bg-background` (gray canvas) instead of white card.
- Empty/loading states weak for PLP.

## Implementation plan (this iteration)

1. **PLP redesign** — shop-shell, quiet H1, sticky white facet card, results toolbar, Ghana-local filters, solid empty state.
2. **Product card** — brand + optional vendor line; shipping meta; add CTA always-on for browsable items; rating uses spark yellow.
3. **CategoryTile** — TanStack `Link` to `/browse/$slug`.
4. **Product rail** — pass brand; denser gaps; carousel chrome on white.
5. **Homepage** — sections already card-wrapped when empty; wrap live rails consistently if needed.

## Out of scope (later)

- Live vendor name on list endpoints (API change for ProductList).
- Full Sparky-style conversational search.
- Vendor portal visual redesign.
