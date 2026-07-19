# Alkemart storefront — marketplace design system (from reference pack)

**Source of truth:** `docs/ux-refs-storefront-full/2026-07-19/` (24 live captures)  
**Audience:** Ghana multi-seller shoppers (COD culture, multi-shop cart, GHS)  
**Brand:** alkemart yellow `#f5c518` · black `#141414` · white · light gray surfaces  
**Not:** dark SaaS hero · generic “AI polish” · cloning Amazon brand  

---

## 1. What the reference images actually teach

I read every usable capture (Amazon home/search/PDP/mobile, Jumia home/search, eBay home/search, Mercado Libre home, Walmart home, AliExpress home). Bot-blocked frames (Etsy, Shopee, Walmart search) are discarded as design signal.

### 1.1 Shared skeleton (all serious marketplaces)

| Zone | Pattern observed | Pixel-level notes |
|------|------------------|-------------------|
| **Chrome height** | Sticky header ~56–64px | Search is the widest flex child |
| **Search** | Pill or full-width field + yellow/brand submit | Amazon: white field, orange/yellow icon button; Jumia: rounded field + orange “Search”; Walmart: full-width pill on blue bar |
| **Actions** | Account · cart (and sometimes language) | Icon + short label on desktop |
| **Dept nav** | Under header or left rail | Jumia: **left category list**; Amazon/eBay: **horizontal secondary nav** |
| **Listing** | Left filters ~220–280px · results · sort top-right | Always present — never “filters later” |
| **Cards** | White bg, photo dominant, title 2 lines, price bold, rating if any, CTA yellow | Square/near-square media |
| **PDP** | 3 columns large: gallery · info · **buy box ~280–320px** | Sticky buy box; yellow Add to cart; sold-by link |
| **Home** | Theme/category cards + product rails — **not** a black marketing strip | Photo-led exploration |

### 1.2 Site-specific DNA we keep or reject

| Source | Keep for alkemart | Reject |
|--------|-------------------|--------|
| **Amazon** | Buy-box PDP; left facets; result density; search dominance | Purple lifestyle bloat as our only home; US-only chrome |
| **Jumia** | Regional multi-seller structure; left categories; flash/deal strip; orange/yellow CTA energy | Cookie-first experience; over-dense ads |
| **eBay** | Multi-vendor honesty; related queries; popular filter chips; list+grid; “shipping to Ghana” metaphor → **delivery to Accra** | Auction complexity, condition filter overload v1 |
| **Mercado Libre** | **Brand yellow as full promo field** (not black); trust tiles under hero; location awareness | Spanish-only copy |
| **Walmart** | Search-first blue bar → we use **black/white + yellow search button**; +Add on cards | Captcha UX, membership upsell as identity |
| **AliExpress** | Deal energy, countdown optional later | Spam overlays, clutter |

### 1.3 Our design choice (locked)

**Hybrid:**  
**Jumia structure (Africa multi-seller)** + **Amazon listing/PDP mechanics** + **Mercado yellow brand field** + **Walmart search priority**.

Name: **“Alkemart Retail Canon v1”**

Visual personality:
- Surfaces: `#fafafa` page · `#ffffff` cards · `#e8e8e8` borders  
- Ink: `#141414`  
- CTA: `#f5c518` fill · `#141414` text (never light text on yellow)  
- Accent dark bars (optional header band): `#141414` with white search field  
- Radii: **retail-tight** — 0–4px on CTAs and search; 8px on cards max (not 24px soft blobs)  
- Type: system UI sans; 14px body; 12px meta; 20–28px titles  
- Density: marketplace (tight), not lifestyle magazine  

---

## 2. Foundations (pixel system)

### 2.1 Layout grid

```
Desktop ≥1200:
  page max-width: 1440px (content 1280–1360 centered)
  gutters: 16–24px
  listing: sidebar 240px | gap 24px | main 1fr
  PDP: gallery 5fr | info 4fr | buybox 3fr  (12-col)

Tablet 768–1199:
  listing: filters collapsible; grid 3 cols
  PDP: gallery+info stacked; buybox under or sticky bottom

Mobile <768:
  header: logo | search icon expands | cart
  bottom nav: Home · Shop · Cart · Account
  filters: sheet
  PDP: gallery full · info · sticky Add bar
```

### 2.2 Spacing scale (4px base)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`

### 2.3 Component inventory (canonical)

1. **AppHeader** — logo, search (primary), language, account, cart badge  
2. **DeptRail** — horizontal chips OR Jumia-style left list on home desktop optional  
3. **PromoField** — light yellow full-width (Mercado energy), max 1 on home  
4. **CategoryCard** — image or monogram + label + link  
5. **ProductCard** — image, title, seller, price, Add  
6. **FilterSidebar** — sort, department, seller, (price later)  
7. **ResultToolbar** — count + sort  
8. **BuyBox** — price, stock, qty, Add, sold-by, COD note  
9. **Breadcrumb** — Home / Department / Product  
10. **TrustStrip** — 3–4 items, light cards  

### 2.4 Page recipes

**Home**
1. Header  
2. Optional single yellow promo field (COD / multi-seller — short)  
3. Dept chips  
4. Featured product **grid** (8)  
5. Shop by department tiles  
6. Sellers rail  
7. Trust  
8. All products / load more  

**Browse / Search**
1. Header  
2. Breadcrumb  
3. H1 + count  
4. Filters (always) | grid  
5. Sort  

**PDP**
1. Header  
2. Breadcrumb  
3. Gallery | About | BuyBox  
4. Related from same seller  

---

## 3. Data & platform requirements

| UI need | Data/API | Status today |
|---------|----------|--------------|
| Product grid | catalog / products with thumbnail, price, offer_id, seller | Partial — few products, thin thumbs |
| Left filters | categories + sellers (+ facets if Meili) | Categories yes; seller facets partial; Meili optional |
| Search engine | Meilisearch or Medusa `q` | Built; needs Meili for Amazon-grade facets |
| Buy box stock | offer sellable | offer_id path exists |
| Ratings/reviews | review service | **Not in stack** — omit or fake never |
| Flash deals | campaign engine | **Not in stack** — omit v1 |
| Image gallery multi | product.images[] | Single thumb common; multi if API returns |
| COD messaging | static + checkout | Yes |

---

## 4. Can we achieve it?

### Honest score

| Target | Achievable? | Notes |
|--------|-------------|--------|
| **Header + search-first chrome** | **Yes — 100%** | Pure frontend |
| **Light yellow promo (Mercado)** | **Yes — 100%** | Already directionally started |
| **Home category cards + product rails** | **Yes — 95%** | Needs real photos for “pixel” quality |
| **Always-on filters (dept + seller + sort)** | **Yes — 90%** | Client-side works; Meili for rich facets |
| **Amazon-style buy box PDP** | **Yes — 90%** | Layout yes; multi-image/variants limited by data |
| **Jumia left category home** | **Yes — 100%** | Layout |
| **Dense Amazon search results** | **Yes — 80%** | Density yes; ratings/“bought last month” need data we don’t have |
| **Pixel-perfect clone of Amazon/Jumia** | **No — and we should not** | Brand + legal + content ops differ |
| **Professional marketplace grade** | **Yes — with discipline** | Foundation tokens + content + no half filters |

### What blocks “pixel perfect professional” (not layout)

1. **Catalog content** — empty/missing product photos make any layout look unfinished  
2. **No reviews** — Amazon density relies on stars; we ship without them (honest empty, not fake)  
3. **Meilisearch off** — filters still work, but not Amazon-scale facets  
4. **Seller tooling** — image-first create must be enforced or home stays sparse  
5. **Worktree sync** — monorepo vs `/home/amber/alkemart-storefront` caused prior 500s; release path must be single source  

### Verdict

**Yes, we can achieve the Alkemart Retail Canon at professional marketplace grade** — matching the *structure and craft* of the reference pack, not cloning Amazon’s brand.

We **cannot** truthfully claim pixel-identical Amazon/Jumia in one sprint without:
- real product imagery and denser catalog  
- optional Meili  
- multi-image PDP  
- design tokens locked and one deploy surface  

**Recommended commitment:**  
Ship **Canon v1** (layout + tokens + header + home + browse filters + buy box) as pixel-specified system, then **content + Meili + gallery** as v1.1.

---

## 5. Implementation phases (no half-ass)

### Phase 0 — Foundations (1 pass)
- CSS tokens: radii, spacing, header heights, sidebar width  
- `AppHeader` exact measurements  
- `ProductCard` exact footprint  
- Single worktree sync rule documented  

### Phase 1 — Home Canon
- Remove remaining non-canon patterns  
- PromoField yellow (Mercado)  
- Featured grid only  
- Dept tiles + sellers  

### Phase 2 — Listing Canon
- FilterSidebar always  
- Sort in URL  
- Result toolbar  
- Dense grid  

### Phase 3 — PDP Canon
- 12-col buy box  
- Sticky mobile CTA  
- Related seller row  

### Phase 4 — Content & search quality
- Seller image-required policy  
- Meili on  
- Multi-image when available  

### Phase 5 — Admin/Seller approach (ops UX)
- Image-first product create  
- Offer price in create flow  
- Ops queues without Mercur jargon  

---

## 6. Explicit non-goals (v1)

- Fake ratings  
- Auto-rotating spam carousels as identity  
- Dark full-viewport brand panels  
- Cloning Amazon purple merchandising  
- Building a full campaign/flash-sale engine  

---

## 7. Success criteria (measurable)

1. Home: no dark hero; yellow promo ≤120px tall; 8 featured cards in grid  
2. Browse: filters visible ≥1024px without Meili  
3. PDP ≥1024px: buy box column present with Add + sold-by  
4. Search empty: popular chips + departments  
5. Zero customer-facing “API / Medusa / Mercur / emailpass” copy  
6. Hard-refresh worktree: no missing-module 500s  

---

## 8. Next action

On approval: implement **Phase 0–3** against this doc only, verify with screenshots next to Amazon/Jumia references, then content ops for photos.
