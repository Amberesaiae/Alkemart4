# Storefront design spine

Architecture for UI — not a dump of components.

```
┌─────────────────────────────────────────────────────────┐
│  design/brand.ts     identity (name, mark, wordmark)    │
│  design/tokens.ts    color · space · radius · layout    │
│  design/icons/       IconSafe + category map            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  shell (nervous system)                                 │
│    BrandLogo · AppHeader · CategoryIconRail             │
│    Container · AppFooter · __root full-bleed shell      │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   home/*              listing/*          product/*
   mosaic              filters            buy panel
   last offers         product grid       peer offers
   delivery            empty/skeleton     related
   advertise
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    product-card (commerce atom)
                    price · seller-chip · cart/checkout
```

## Rules

1. **Brand** only via `design/brand` + `BrandLogo` — never hardcode `a` monograms or random taglines in chrome.
2. **Header chrome** = logo · search · account · cart. No language. No Home/Last Offers/Help links (footer + in-page).
3. **Category discovery** = `CategoryIconRail` under header (icon + label).
4. **Home page composition** is fixed Mowafer order: mosaic → last offers → delivery → advertise.
5. **ProductCard** is the only product presentation atom for grids (density: compact | comfortable).
6. **Demo seed** fills sparse catalog for lab UX; real offers stay buyable.

## Page shell

Full-bleed viewport: header / rail / main / footer. Content max-width on rows only — not a nested page card.
