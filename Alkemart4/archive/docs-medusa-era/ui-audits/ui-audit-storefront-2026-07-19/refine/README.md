# Storefront refine audit — 2026-07-19

Compared live `:5175` against `ui/imgi_10_f14deb69721237.5b93138a5c0dd.png`.

## Screenshots

| File | Content |
|------|---------|
| `00-ref-imgi10-last-offers.png` | Mowafer reference Last Offers crop |
| `01–02` | Home full / viewport (early) |
| `03` / `09` | PLP tiles |
| `04` | Header + rail + mosaic |
| `05–07` | Last Offers card hierarchy (early) |
| `08` / `10` | After stars + bookmark |
| **`11-home-board-locked.png`** | Full home after board-lock |
| **`12-last-offers-board.png`** | Last Offers (hierarchy locked) |
| **`13-header-mosaic.png`** | Header + mosaic |

## Status vs imgi_10

| Area | Status | Notes |
|------|--------|-------|
| Text logo `alkemart.` | ✅ | Gold period |
| Header search + account + cart | ✅ | ICONPAK2 cart `imgi_462` |
| Dept rail icon **beside** label | ✅ | 6 depts, no All |
| Mosaic photo tiles | ✅ | Full-bleed WebP, single-line titles |
| Last Offers icon tabs | ✅ | Icon-only + caption + sort + grid/list |
| **hero** card | ✅ | TV slot locked · stars · Add To Cart |
| **feature** landscape | ✅ | Fan/home slot · media left · pill CTA |
| **row** horizontal | ✅ | Stars · bookmark · cart |
| **tile** dense | ✅ | Bookmark + cart circle |
| View More pill | ✅ | Centered |
| Wishlist | ✅ | Bookmark (not heart) |
| Star rating | ✅ | Inline gold SVG |
| Board hierarchy | ✅ | First 6 demos lock slots; real offers after |

## Implementation map

| Component | Path |
|-----------|------|
| ProductCard (hero/feature/row/tile) | `src/components/product-card.tsx` |
| ProductRating | `src/components/product/ProductRating.tsx` |
| WishlistButton | `src/components/product/WishlistButton.tsx` |
| AddToCartControl | `src/components/product/AddToCartControl.tsx` |
| HomeLastOffers | `src/components/home/HomeLastOffers.tsx` |
| CategoryIconRail | `src/components/shell/CategoryIconRail.tsx` |
| CategoryMosaic | `src/components/home/CategoryMosaic.tsx` |
| Seed / board order | `src/lib/demo/home-seed.ts` → `resolveHomeProducts` |
| Card anatomy doc | `apps/storefront/docs/PRODUCT_CARD_MAP.md` |

## Fixes this session

1. Wishlist → bookmark glyph  
2. Stars → gold inline SVG (removed bad `star.webp`)  
3. Cart CTA → ICONPAK2  
4. Board hierarchy locked: slots 0–5 always demo structure  
5. Hero TV uses `cat-electronics-tv.webp`  
6. Feature + side stack height alignment  
7. Product atoms barrel export `components/product/index.ts`  

## PLP pass (imgi_11 / imgi_12)

| File | Dept |
|------|------|
| `14-plp-pet.png` | Pet Care — magenta sidebar |
| `15-plp-electronics.png` | Electronics — teal sidebar |
| `16-plp-food.png` | Food |

### Modular modules (no inline CSS)

| Module | Role |
|--------|------|
| `ListingHero` | “Get All … From One Place!” + art |
| `ListingFilterStrip` | Subcat · rating · price · view |
| `ListingFilters` | Categories (`.theme-dept-*`) · Sellers (`.brands-panel`) |
| `styles/index.css` | `.dept-panel`, `.brands-panel`, scrims, delivery glow |
| `lib/category-theme.ts` | `deptThemeClass()` only — no hex in JSX |

**Residual `style={` in src:** none (comment-only).
