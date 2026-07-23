# PLP map — Mowafer imgi_11 + imgi_12

Sources:
- `ui/E-Commerce Platform _ Mowafer __ Behance/imgi_11_*.png` — Pet Care PLP
- `ui/E-Commerce Platform _ Mowafer __ Behance/imgi_12_*.png` — Food + Electronics PLP

## Vertical hierarchy

```
HEADER  logo · search · account · cart
CATEGORY RAIL  icon|label horizontal (6 depts)
────────────────────────────────────────────
BREADCRUMB  Home / {Department}
PLP HERO    “Get All … From One Place!” + lifestyle art (right)
FILTER STRIP (white card, 4 columns)
  · Sub-category radios
  · Average Rating (star rows)
  · Price min–max
  · Grid | List
MAIN GRID
  ┌ sidebar ─────────┬ products ──────────────┐
  │ Categories       │ feature / dense tiles  │
  │  (accent fill)   │                        │
  │ Brands / Sellers │                        │
  │  (dark gray)     │     [ View More ]      │
  └──────────────────┴────────────────────────┘
FOOTER
```

## Department accent (Categories panel only)

| Dept | Panel fill | Text |
|------|------------|------|
| Pet Care | `#F0295A` magenta | white |
| Food | `#FEBF31` yellow | dark |
| Electronics | `#50D1C8` teal | white |
| Personal / Cosmetics | pink / dark | contrast |
| Default | teal | white |

Implemented as **CSS theme classes** (`.theme-dept-*` + `.dept-panel`) — **no inline `style=`**.

## Brands / Sellers panel

- Always dark gray `#5A5A5A`, white type
- Checkboxes multi-select
- Class: `.brands-panel`

## Filter strip (horizontal)

White rounded card under hero:
1. Sub-categories (radio)
2. Average rating (min stars radio)
3. Price inputs
4. View mode grid|list

## Product cards

Reuse home card system: `feature` / `row` / `tile` from `PRODUCT_CARD_MAP.md`.

## Module map

| Piece | Module |
|-------|--------|
| Theme tokens + classes | `styles/index.css`, `lib/category-theme.ts` |
| Hero | `listing/ListingHero.tsx` |
| Filter strip | `listing/ListingFilterStrip.tsx` |
| Sidebar filters (collapsible sections) | `listing/ListingFilters.tsx` |
| Page chrome (collapsible filters disclosure) | `listing/ListingLayout.tsx` |
| Filter strip (facets only; sort/view in chrome) | `listing/ListingFilterStrip.tsx` |
| Route | `routes/browse.$slug.tsx` |
