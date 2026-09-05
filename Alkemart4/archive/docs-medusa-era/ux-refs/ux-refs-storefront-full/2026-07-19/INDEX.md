# Multi-vendor storefront UI reference pack

**Captured:** 2026-07-19  
**Folder:** `docs/ux-refs-storefront-full/2026-07-19/`  
**Viewport:** 1440×900 desktop (unless `*-mobile`)

## Captured surfaces

| File | Site | Surface | Notes |
|------|------|---------|--------|
| `amazon-home.png` | Amazon | Home | Search-first header, category cards, hero carousel |
| `amazon-home-mobile.png` | Amazon | Home mobile | |
| `amazon-search.png` | Amazon | Search “rice” | **Left filters** + product grid |
| `amazon-search-cooking-oil.png` | Amazon | Search | |
| `amazon-pdp-from-search.png` | Amazon | PDP | **Buy box** right: price, stock, qty, Add to cart |
| `amazon-pdp.png` | Amazon | PDP | Direct ASIN (may be thin) |
| `walmart-home.png` | Walmart | Home | Blue header, giant search, product rail (+ captcha overlay) |
| `walmart-home-mobile.png` | Walmart | Home mobile | |
| `walmart-search.png` | Walmart | Search | **Blocked** by bot wall |
| `ebay-home.png` | eBay | Home | Multi-vendor: category icons, search + category scope |
| `ebay-home-mobile.png` | eBay | Home mobile | |
| `ebay-search.png` | eBay | Search | Filters left, list/grid results |
| `ebay-search-fabric.png` | eBay | Search | |
| `jumia-ng-home.png` | Jumia NG | Home | **Closest regional peer** — left category nav, flash sales, COD culture |
| `jumia-ng-home-mobile.png` | Jumia NG | Home mobile | |
| `jumia-ng-search.png` | Jumia NG | Search | Results + filters language |
| `mercadolibre-home.png` | Mercado Libre | Home | Yellow brand hero, trust tiles, multi-vendor |
| `mercadolibre-search.png` | Mercado Libre | Search | Account gate / thin |
| `aliexpress-home.png` | AliExpress | Home | Global multi-vendor |
| `target-home.png` | Target | Home | Retail header pattern (loading overlay) |
| `etsy-home.png` / `etsy-search.png` | Etsy | — | **Bot blocked** |
| `shopee-sg-home.png` | Shopee | — | **Bot blocked** |

## Pattern synthesis (what “professional marketplace” looks like)

### 1. Header (canonical)
- **Search is the product** — widest element in the chrome (Amazon, Walmart, eBay, Jumia, Mercado Libre)
- Logo left · search center · account + cart right  
- Secondary: departments / categories  
- **No dark SaaS marketing banner** as the main identity of the shop

### 2. Home
- **Amazon:** theme cards (photo + label) → category exploration, not one black strip  
- **eBay:** icon category rail + lifestyle hero + clear multi-seller search  
- **Mercado Libre:** brand-color **light** hero (yellow) + trust/benefit tiles  
- **Jumia:** left department list + promo carousel + flash deals (Africa multi-vendor)  
- **Walmart:** blue header + product carousels with **+ Add** on card  

### 3. Search / category listing
- **Always a left filter rail** (brand, price, ratings, availability)  
- Sort control (Featured / price / rating)  
- Dense product grid: image · title · rating · price · CTA  
- Result count + “related searches”

### 4. Product detail (PDP)
- **3-zone Amazon buy-box:**  
  1. Gallery (left)  
  2. Title, seller, variants, bullets (center)  
  3. **Purchase card** (right): price, stock, qty, Add to cart, sold-by  
- Seller name is a first-class link  
- Delivery / COD messaging near buy  

### 5. Ghana / alkemart takeaways
- Closest peers: **Jumia** (regional multi-seller) + **Mercado Libre** (brand yellow) + **Amazon** (PDP + filters)  
- Alkemart yellow should behave like Mercado’s yellow: **promo/brand energy**, not black panels  
- COD / multi-seller trust near cart, not engineering copy  
- Filters on every listing page — never “filters after search sync”

## How to open

Browse files in:

`docs/ux-refs-storefront-full/2026-07-19/`

On Windows Explorer via the monorepo path under `Alkemart4`.
