# Storefront design spine (Mowafer lab)

Regenerated from `docs/research/mowafer-behance-clone/` — not the drifted production spine.

```
┌─────────────────────────────────────────────────────────┐
│  design/brand.ts     alkemart. wordmark                 │
│  styles/index.css    --primary #FEBF31 · --foreground   │
│                      --dept-* accents                   │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  shell                                                  │
│    BrandLogo · AppHeader · CategoryIconRail (max 6)     │
│    AppFooter · BottomTabBar (md:hidden)                 │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   home/*              listing/*          product/*
   mosaic              hero + strip       gallery
   last offers         accent + dark      buy panel
   delivery            side panels        peer offers
   advertise           sheet on mobile    sticky buy
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    ProductCard (tile | row)
                    cart · stepped checkout
```

## Rules

1. **Brand** only via `design/brand` + `BrandLogo`. Gold is CTA/accent — no `bg-primary/N` washes.
2. **Header** = logo · search (“Find products with best price”) · Home · Stores · Purchases · account · cart. No language switcher. No second Search button outside the field.
3. **Category rail** under the header, cap 6, food last among core departments (`phones-electronics` → fashion → home → health → baby → `food-groceries`).
4. **Home course** is locked: mosaic → last offers → delivery → advertise. Studio campaigns never lead.
5. **ProductCard** is the only product atom (title · seller · price · rating only if `ratingCount > 0` · yellow Add).
6. **Honesty:** no invented % off, ratings, stock meters, or catalogue fill. Peer offers only when `offerCount > 1`.
7. **Checkout** is a linear machine: Address → Delivery → Payment (COD + Paystack) → Success. No loyalty points.

## Mobile

- Bottom tabs (≤768px / `md:hidden`): **Home · Offers · Search · Account**. Cart stays in the top bar. Tab count ≤ 5.
- **Offers** destination: `/search?deals=1` (newest catalog slice, honest empty if none).
- PLP filters open in `Sheet`. PDP sticky buy bar sits above the tab bar. Checkout stays single column.

## Page shell

Full-bleed viewport: header / rail / main / footer. Content max-width on rows only. Main is padded for the mobile tab bar (`pb-20 md:pb-8`).
