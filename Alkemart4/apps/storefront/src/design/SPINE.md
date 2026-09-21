# Storefront design spine

Architecture for UI — a contract, kept in sync with the code. If this file and a
component disagree, one of them is wrong; fix it the same day.

```
┌─────────────────────────────────────────────────────────┐
│  design/brand.ts     identity (name, mark, wordmark)    │
│  styles/index.css    tokens (color · type roles · shadow│
│                      · dept themes · focus · motion)    │
│  design/icons/       IconSafe + category map            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  shell (nervous system)                                 │
│    BrandLogo · AppHeader · DeliverToPicker              │
│    CategoryReel (browse/search) · AppFooter             │
│    Container · __root full-bleed shell                  │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   home/*              listing/*          product/*
   beats (below)       facets             gallery
   deals hub           sort/filter        buy panel
   store rail          grid               peer offers
   skeletons           empty/skeleton     reviews
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    product-card (commerce atom)
                    price · seller-chip · cart/checkout
```

## Rules

1. **Brand** only via `design/brand` + `BrandLogo` — never hardcode `a` monograms or random taglines in chrome.
2. **Header hierarchy** = main row `logo · search · account · cart`; context row `Deliver to · departments · Stores`. Location must never interrupt the logo-to-search path.
3. **Search** submits on Enter; the Search button lives inside the field. No second search affordance in the nav row.
4. **Category discovery** = mosaic on home (taxonomy), `CategoryReel` under the header / top of browse (verb rail), facet panel on PLP (narrowing). One affordance per context; the reel is never sandwiched between two shelves.
5. **Home composition is the marketing course** (see `packages/shared/src/homepage.ts`, `composeMarketCourse`):

   ```
   mosaic → Featured → Deals of the Day (dept tabs) → [Studio campaigns] → Top Rated Items → Top Rated Shops
   ```

   Campaigns never lead. Beats de-duplicate against each other; a beat that cannot fill collapses.
6. **ProductCard** is the only product presentation atom (`size: tile | store | row`). One fact set in one order — title · seller · price · rating. A surface changes *size*, never the facts.
7. **ShopCard** (`StoreCard*` in `packages/ui`) is the only shop presentation atom: art → name → location → facts (rating · band) → badges → featured strip. A shop with no banner gets the monogram fallback, never a blank tile.
8. **Numbers never render bare.** Every figure carries its unit in the component that renders it — `38 reviews`, not `38`. One rating formatter (`lib/product-rating.ts`); an unearned score renders as nothing.
9. **Loading states shimmer at true geometry** (`ProductCardSkeleton`, `ShelfSkeleton`, `ShelfFallback`): the placeholder mirrors the real component's boxes so nothing shifts when data lands. Demo seed never stands in for a loading state.
10. **Gold is an accent, never a surface.** One gold primary action per decision area is the budget. Inline campaign tiles are ink with gold accents (`tone-*` ramp in `styles/index.css`).
11. **Spacing rhythm:** page beats `32px mobile / 48px desktop` · section interiors `24px` · component groups `16px` · control groups `8px`. Keep to the scale; no one-off margins.
12. **Demo seed** fills sparse catalog for lab UX in *lab surfaces only*; the merchandising course renders honest empties. Real offers stay buyable.

### Foundation decision — 2026-09-20

MOWAFER supplies the commerce hierarchy; Alkemart supplies the brand, Ghana
context and multi-seller model. Montserrat, `#FEBF31` yellow and `#3C3C3B` ink
are the foundation. Hubtel/Hapto may be implementation research, but neither is
a normative visual source for this storefront.

## Page shell

Full-bleed viewport: header / main / footer. Content max-width `1200px` on rows
only — not a nested page card.
