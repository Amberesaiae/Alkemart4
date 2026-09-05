# Ghana × Mowafer marketplace — system audit, journeys & backend-first plan

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Status** | **LOCKED** — audit + plan + foundation implementation |
| **Sources** | `ui/MOWAFER E-Commerce App UI_UX Design __ Behance/*`, web pack imgi_10–13, live storefront, Mercur/Medusa backend |
| **Rule** | Backend-first data contracts; storefront never invents money/sellers/categories; Ghana-first discovery |

---

## 0. Executive thesis

**Mowafer product thesis (Egypt reference):** multi-retailer price comparison + grocery/electronics commerce + delivery slots + COD/cards/loyalty.

**Alkemart thesis (Ghana):** multi-**seller** marketplace (not multi-retailer scrape). One catalog, many **offers** per product, GHS + COD-first, Ghana addresses, seller readiness gates. UI is **Mowafer-shaped** (imgi_10 home, imgi_11/12 PLP, mobile IA/journey/checkout).

```
┌─────────────────────────────────────────────────────────────┐
│ BUYER  apps/storefront  (Mowafer chrome — do not malign)     │
│  Home · PLP · PDP peer offers · Cart · Checkout · Account   │
└───────────────────────────┬─────────────────────────────────┘
                            │ Store API only (offer_id ATC)
┌───────────────────────────▼─────────────────────────────────┐
│ ENGINE  Medusa v2 + Mercur                                  │
│  Product ──M:N── Category     Seller ──owns── Product       │
│  Offer (ATC SoT)              Order / OrderSet multi-seller │
│  Region GH + GHS              Search Meili (discovery)      │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
     ┌──────────▼──────────┐       ┌──────────▼──────────┐
     │ SELLER  /seller     │       │ ADMIN  /dashboard   │
     │ Onboarding · catalog│       │ Moderate sellers/   │
     │ offers · stock loc  │       │ products · markets  │
     └─────────────────────┘       └─────────────────────┘
```

**Three doors, never mixed into the buyer SPA.**

---

## 1. Mowafer mobile pack — thorough board inventory

Path: `ui/MOWAFER E-Commerce App UI_UX Design __ Behance/`

| Board | Role | Atomic content |
|-------|------|----------------|
| **imgi_9 / imgi_50** | **01 IA** | 4 levels: Home → domain → product/commerce → checkout steps |
| **imgi_10 / imgi_51** | **02 Journey + 03 Guidelines** | Full flow graph; palette #FEBF31 / #3C3C3B; category colors; Montserrat + Cairo |
| **imgi_12 / imgi_53** | **Mobile screens** | Splash, home (yellow header, category tiles, Deals of Day), deals, account, PDP + **Other Prices/Retailers**, bottom nav |
| **imgi_14 / imgi_55–56** | **Checkout** | Cart (lines + remove/wishlist) → Address → Payment (COD + points) → Delivery slots (day/time) → Done |

### 1.1 IA (atomic nodes)

```
Home
├── Featured / Latest Offers → Product → Comparison | Cart → Checkout
├── All Categories → PLP → Product → …
├── Account → Login/Signup → Settings → Points
├── Wishlist → Edit/Remove
├── Customer Care → FAQ / Privacy / Terms
├── Articles / About / Contact
└── Cart → Checkout L4: Address · Delivery Method · Payment
```

### 1.2 Mobile UX patterns (map → Alkemart)

| Mowafer mobile | Alkemart web (current) | Gap |
|----------------|------------------------|-----|
| Yellow app header + search | White header + yellow Search CTA | OK (web pack) |
| Colored category **squares** | Horizontal icon\|label rail | OK intentional |
| Bottom nav Home/Offers/Search/Account | No bottom nav (SPINE) | Keep desktop; optional mobile later |
| PDP “Other Prices / Retailers” | `PeerOffersList` (sellers) | Scale: offers API fragile |
| Cart delivery fees by group | Cart by seller | Partial shipping fees |
| Delivery time slots | Not implemented | Phase 2 after stock zones |
| Loyalty points | Not productized | Out of scope until spine |
| Wishlist | Local bookmark UI only | Needs wishlist API later |

### 1.3 Design guidelines locked (already in tokens)

| Token | Value |
|-------|--------|
| Primary | `#FEBF31` |
| Ink | `#3C3C3B` |
| Electronics / Food / Pet / Beverages / Health / Baby | `#50D1C8` / `#FEBF31` / `#F0295A` / `#9AC63B` / `#3C3C3B` / `#E8E8E8` |
| Type | Montserrat (EN); Cairo reserved for future AR (not Ghana-required) |

---

## 2. Current architecture (as-built)

### 2.1 Surfaces

| Actor | App | Auth | Money |
|-------|-----|------|--------|
| Buyer | `apps/storefront` | Customer JWT + publishable key | Cart `offer_id` → Ghana checkout COD/MoMo lab |
| Seller | Mercur `apps/vendor` `/seller` | Member + `x-seller-id` | Offers, stock, shipping profiles |
| Admin | Mercur `apps/admin` `/dashboard` | Admin user | Approve sellers/products |

### 2.2 Domain SoR (do not fork)

| Concept | SoR | Notes |
|---------|-----|--------|
| Product | Medusa product | Status draft/proposed/published/rejected |
| Category | Medusa `product_category` **M:N on product** | Platform taxonomy |
| Seller | Mercur seller | pending → open → suspended |
| Sellable unit | **Offer** | ATC requires `offer_id` |
| Market | Medusa Region + Alkemart operating-markets | GH / GHS |
| Discovery | Meilisearch (optional) | Facets: category, seller, price — **not location yet** |
| Money | Cart + order | Never invent prices in SPA |

### 2.3 Multi-category stores — truth

| Question | Answer |
|----------|--------|
| Can one seller sell Food **and** Electronics? | **Yes** — assign categories on **products** |
| Is “store departments” first-class? | **No** — no seller↔category table |
| How does UI show multi-dept store? | **Derived**: group products by `category_handles` / labels |

**Dashboard plan (seller):**

1. Product form: multi-select categories (Mercur already product-centric).
2. Optional later: seller “featured departments” = metadata or derived top-N categories (display only, not SoR).
3. **Do not** create a second category tree owned by sellers.

**Admin gating:**

1. Seller register → `pending_approval` → admin approve → `open`.
2. Product propose → quality score → admin confirm/reject.
3. Sellable requires: open seller + setup (stock location, channel, GHS offer, shipping) + published + offer.

---

## 3. Atomic user journeys × backend × frontend

### J1 — Discover (Home)

| Step | Frontend | Backend | Failure honesty |
|------|----------|---------|-----------------|
| 1 Load shell | `__root` cart + categories | `cart`, categories, session | Empty rail → demo fill only if `HOME_DEMO` |
| 2 Mosaic | 4 photo tiles | Category handles | Demo handles if sparse |
| 3 Last Offers | hero/feature/row/tile | Catalog + offers hydrate | No offer → no ATC |
| 4 Delivery/Advertise | Static + sell URL | Vendor URL env | |

### J2 — Browse PLP (Mowafer imgi_11/12)

| Step | Frontend | Backend | Gap |
|------|----------|---------|-----|
| Hero | `ListingHero` | category name + art | Art from local WebP |
| Filter strip | subcat, rating, price, view, **location** | Search filters | Subcat/rating/location need data |
| Sidebar categories | `.theme-dept-*` | product_categories | Accent CSS only |
| Sellers panel | multi-check | seller_handles facet / client | |
| Grid | feature + tiles | catalog/search | |

### J3 — Search

| Step | Frontend | Backend |
|------|----------|---------|
| Query | `/search?q=` | `POST /store/search` |
| Facets | category + seller | Meili `facetDistribution` |
| Location | filter UI | **Additive** `province`/`city` when indexed |

### J4 — PDP multi-seller (Mowafer “Other Prices”)

| Step | Frontend | Backend |
|------|----------|---------|
| Product | retrieve | product + variants |
| Peer offers | `PeerOffersList` | `GET /store/offers` (improve: by product_id) |
| ATC | selected `offer_id` | cart line |

### J5 — Cart multi-seller

| Step | Frontend | Backend |
|------|----------|---------|
| Lines | group by seller | cart hydrate seller |
| Shipping | per-seller options | shipping options map |

### J6 — Checkout (Ghana)

| Step | Frontend | Backend |
|------|----------|---------|
| Address | `MarketAddressFields` | `/store/alkemart/markets` locale |
| Region/city | GH 16 regions | Customer address |
| Payment | COD default; MoMo lab | `POST /store/ghana-checkout` |
| Success | `/order/$id` | order retrieve |

### J7 — Seller onboarding (out of SPA)

| Step | Surface | Gate |
|------|---------|------|
| Register member | Seller hub | Auth |
| Create seller | Seller hub | pending |
| Admin approve | Admin | open |
| Setup profile GH + stock + channel + shipping | Seller hub | can_propose |
| Create product + categories | Seller hub | quality |
| Create GHS offer | Seller hub | sellable index |

### J8 — Admin moderation

| Queue | Endpoint family | Action |
|-------|-----------------|--------|
| Sellers | `/admin/alkemart/moderation/sellers` + Mercur approve | open/suspend |
| Products | moderation/products + confirm/reject | publish |
| Stats | `/admin/alkemart/stats` | ops |

### J9 — Store page (seller hierarchy)

| Step | Today | Target |
|------|-------|--------|
| Header | name, bio | + derived category chips |
| Catalog | client filter limit 48 | `catalog?seller_handle=` server |
| Arrangement | flat grid | **sections by category** |

---

## 4. Location search in filters (Ghana)

### 4.1 Principles

1. Location is **delivery / seller service context**, not a second product taxonomy.
2. Index only **real** fields: seller address city/region **or** stock_location metadata.
3. UI never fakes “ships to Accra” without data.
4. Checkout address remains SoR for fulfillment; discovery filter is optional pre-filter.

### 4.2 Data model (backend-first)

```
Seller.address.city / province     ──┐
StockLocation.address.*            ──┼──► SearchProductDocument
Seller.metadata.service_regions[]  ──┘     .seller_city
                                           .seller_province
                                           .service_regions[]
```

Meili filters (additive):

```ts
filters: {
  category_handles?: string[]
  seller_handles?: string[]
  seller_province?: string   // e.g. "Greater Accra"
  seller_city?: string       // e.g. "Accra"
  // later: service_regions includes shopper region
}
```

### 4.3 Frontend (modular)

- `ListingLocationFilter` — region select (16 GH) + city combobox (major cities)
- Wired into `ListingFilterStrip` + search facets when distribution present
- When index lacks location facets: control disabled with honest copy:  
  **“Location filter activates when sellers publish service areas.”**

### 4.4 Implementation phases

| Phase | Work | Breaks UI? |
|-------|------|------------|
| **P0** | Types + UI + empty-state honesty | No |
| **P1** | Index seller city/province from readiness address | No (additive) |
| **P2** | Seller “service regions” multi-select in hub | No |
| **P3** | Shopper “Deliver to” sticky chrome (optional) | Design only |

---

## 5. Multi-category seller — backend & dashboards

### 5.1 Product-level (already correct)

```
Product ──<product_category>── Category (platform tree)
Seller ──owns── Product
```

Seller hub: assign **multiple categories per product** at create/edit.  
Admin: taxonomy management (Ghana seed handles). Enforce `ALKEMART_REQUIRE_CATEGORY_ON_PROPOSE=true` when hub UX is solid.

### 5.2 Store-level merchandising (display contract)

**Derived, not SoR:**

```ts
// GET /store/alkemart/vendors/:slug  (extend)
{
  vendor: { id, name, handle, bio, ... },
  category_handles: string[],  // top N from published products
  category_names: string[],
}
// GET /store/alkemart/catalog?seller_handle=
{ products: StoreProductCard[] } // each with category_label, category_handles
```

Storefront arranges:

```
Store header
Category chips (derived)
For each category_name:
  Section title
  Product grid
```

### 5.3 Admin gating matrix (pragmatic)

| Gate | Who | When | Effect |
|------|-----|------|--------|
| Seller approval | Admin | After register | Seller `open` |
| Setup checklist | System | Before propose | Block product create |
| Product quality score | System | Propose | Soft/hard score |
| Product confirm | Admin | Proposed | Published |
| Offer create | System | Seller open + setup | GHS offer |
| Sellable recompute | Job/subscribers | Offer/stock change | Search index |
| Suspend | Admin | Policy | Hide from catalog |

---

## 6. Frontend architecture rules (protect Mowafer)

1. **Spine:** brand → tokens → icons → shell → home/listing/product → product-card.
2. **No inline CSS** — themes via `.theme-dept-*`, panels via CSS modules/utilities.
3. **No invented commerce** — empty preferred over fake offer/price/seller.
4. **Layout hierarchy locked** — home slots, PLP hero/strip/sidebar, card sizes.
5. **Additive APIs only** — optional fields; SPA feature-detects.
6. **Demo seed** — visual only; never production money path.

### 6.1 Contract: `StoreProductCard` (stable)

```ts
{
  id, title, handle?, thumbnail?, description?,
  offerId?, amount?, currencyCode?,
  seller?: { id?, name?, handle? },
  categoryLabel?, categoryHandles?: string[],
  rating?, ratingCount?,
  // location (optional, discovery)
  sellerCity?, sellerProvince?,
  demo?, demoCategory?
}
```

### 6.2 Contract: Search filters (stable + location)

```ts
{
  category_handles?, seller_handles?,
  min_price?, max_price?, has_offer?,
  seller_province?, seller_city?
}
```

---

## 7. Gaps vs Mowafer journeys (prioritized backlog)

| Prio | Gap | Backend | Frontend |
|------|-----|---------|----------|
| P0 | Location filter types + honest UI | — | ✅ foundation |
| P0 | Store multi-category sections | derived categories | ✅ group by label |
| P1 | Catalog returns price + category_label | enrich catalog route | consume |
| P1 | `catalog?seller_handle=` | query param | store page |
| P1 | Offers by product_id | scoped endpoint | PeerOffers |
| P2 | Index seller city/province | search documents | enable filter |
| P2 | Sub-category real tree | nested product_category | strip radios |
| P2 | Delivery slots | fulfillment windows | checkout step |
| P3 | Wishlist API | customer favorites | replace local |
| P3 | Reviews/ratings SoR | reviews module | stars filter truth |
| P3 | Loyalty points | out of spine | omit |
| P3 | Mobile bottom nav | — | optional later |

---

## 8. Ghana context checklist

| Concern | Status | Plan |
|---------|--------|------|
| GHS currency | Strong | Keep |
| COD first | Strong | Keep |
| MoMo | Lab flag | Paystack spine when ready |
| 16 regions + major cities | Constants exist | Location filter uses them |
| GhanaPostGPS | Address optional | Keep optional |
| Multi-city discovery | **Weak** | P1–P2 location index |
| Seller service areas | Missing | Seller hub metadata P2 |
| Phone +233 | Strong | Keep |

---

## 9. What we will **not** do (anti-malign)

- Rebuild admin/seller inside storefront.
- Second category SoR for sellers.
- Fake location availability.
- Hardcode product prices or invent peer offers.
- Replace Mowafer card hierarchy with generic grids.
- Force bottom-nav Amazon chrome on web.

---

## 10. Implementation log (this pass)

1. This ADR locked.
2. Search types: `seller_province`, `seller_city` (FE + BE types).
3. `ListingLocationFilter` + strip integration.
4. Store page: category-section arrangement when labels exist.
5. Sub-category client filter on `categoryLabel` / title keywords (honest partial until taxonomy tree).

---

## 11. Success criteria

- [ ] Buyer can filter by GH region/city when sellers publish location (P2).
- [ ] Store with multi-category products shows sections (P0 UI + P1 API).
- [ ] Admin gates seller/product without SPA changes.
- [ ] Home/PLP/PDP remain Mowafer-hierarchical with real offers only.
- [ ] Zero inline CSS on new surfaces; themes class-based.

## 12. Atomic workflow plan pack

Execute and reevaluate via:

**`docs/architecture/workflow-plans-2026-07-19/`** (W01–W15 + screenshots + sync score).
