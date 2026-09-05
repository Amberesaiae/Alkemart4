# Complete multivendor ecommerce UI/UX plan — Alkemart

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | Planning — research-backed; implementation on **`apps/storefront` only** |
| **Surfaces** | Buyer SPA (shadcn); Seller/Admin = **Mercur** (not redesigned here) |
| **Market** | Ghana-first, mobile-first, GHS, multi-vendor |
| **Constraints** | No hardcodes/magic; Mode B honesty until money spine; yellow/white/black brand locked |
| **Research base** | Baymard (checkout ~70% abandonment, form reduction, guest checkout, PDP); mobile CWV/trust; Ghana MoMo/mobile commerce patterns; prior Alkemart Ghana redesign + Walmart hierarchy notes |

---

## 1. Executive north star

**Alkemart should feel like a modern multi-vendor market that a shopper in Accra can trust on a phone:**

- Find products fast (search + categories)  
- Know **who is selling** and what delivery means  
- Checkout with **honest payment** (COD now; MoMo when product-ready)  
- Track a clear **order reference** after purchase  

**Not:** US big-box clone, dual-home admin in the SPA, invented prices, or claiming MoMo production while it’s lab-only.

### Three products, three UIs

```text
┌──────────────────────────┐
│  apps/storefront         │  Buyer UX (this plan)
│  shadcn + Radix + brand  │
└────────────┬─────────────┘
             │ store API only
┌────────────▼─────────────┐
│  Mercur / Medusa :9000   │
│  /seller  Vendor UX      │  Upstream Mercur patterns
│  /dashboard Admin UX     │  Upstream Mercur patterns
└──────────────────────────┘
```

Seller/admin UX improvements = Mercur configuration, copy, and onboarding docs — **not** rebuilding ops in shadcn.

---

## 2. Research synthesis (what “best practice” means)

### 2.1 Industry (Baymard & checkout science)

| Finding | Implication for Alkemart |
|---------|--------------------------|
| Average cart abandonment ~**70%**; many losses are UX-fixable | Obsess over checkout length and clarity |
| Ideal checkout can be **~12–14 form elements** (fewer fields in practice) | COD form: name, phone, address, city, region, country — cut dead fields |
| **Guest / low-friction** account paths convert better when prominent | Offer continue as guest *or* optional account; never force long signup before cart |
| Trust anxiety peaks at payment | Trust microcopy + payment logos **next to** pay CTA |
| PDP is visited by nearly every buyer | PDP is conversion-critical: price, seller, delivery, primary CTA sticky on mobile |
| Horizontal tabs on PDP hide content poorly | Prefer progressive disclosure / stacked sections on mobile |
| Mobile-first is non-negotiable | Design thumb-zone CTAs, 44px targets, correct `inputmode` |

### 2.2 Multivendor-specific UX

| Principle | Buyer needs | UI pattern |
|-----------|-------------|------------|
| **Sold-by trust** | Who am I buying from? | Vendor chip on card + PDP + cart line |
| **Unified catalog** | One search across sellers | Single PLP grid; vendor secondary |
| **Delivery honesty** | Multi-seller = multi-shipping | Cart groups by seller when multi-seller; never fake ETAs |
| **Ratings** | Social proof | Show only real ratings from API; else omit (no fake 4.8) |
| **Store pages** | Brand of seller | `/store/$slug` from API handle only |
| **Dispute path** | When something breaks | Clear “help with order” — email/honest channel until productized |

### 2.3 Ghana / emerging market mobile commerce

| Local constraint | UX response |
|------------------|-------------|
| Majority smartphone traffic; data cost | Compress images; lazy load; avoid heavy carousels on home |
| MoMo dominant when payments live | Network picker (MTN / Telecel / AT), wallet phone, “approve on phone” pending state |
| COD still trusted | COD as first-class, clear “pay rider” copy |
| Addresses | Landmark + city + region; optional GhanaPost GPS; phone required |
| Trust | Local language tone; GHS (GH₵); seller names; no foreign-only payment logos when MoMo is the story |

### 2.4 Accessibility & performance (non-optional)

| Area | Standard |
|------|----------|
| Tap targets | ≥ 44×44 CSS px |
| Contrast | WCAG AA for body text on white |
| Focus | Visible focus rings (Radix/shadcn default + brand ring) |
| Forms | Labels always; errors associated with fields |
| LCP | Hero/product image optimized; no layout shift from late badges |
| CLS | Reserve image aspect ratio on cards |
| Status | `aria-live` for cart add / checkout errors |

### 2.5 Design system (already chosen)

| Layer | Content |
|-------|---------|
| L0 | Yellow `#f5c518` / white / black tokens |
| L1 | shadcn/ui + Radix primitives |
| L2 | Domain: ProductCard, Price, SellerChip, OrderSummary, AddressFields, EmptyState… |
| L3 | Routes compose L2 + data hooks only |

**Rule:** No new raw buttons/inputs in routes; no commerce hardcodes (IDs, prices, invent stock).

---

## 3. Information architecture (buyer)

### 3.1 Primary nav (mobile bottom or sticky top)

| Item | Route | Priority |
|------|-------|----------|
| Home | `/` | 1 |
| Search | opens search sheet / `/search` | 1 |
| Cart | `/cart` | 1 (badge = qty from API cart) |
| Orders | `/orders` | 2 (auth) |
| Account | `/account` or `/signin` | 2 |

**External only:** Sell → `VITE_MERCUR_VENDOR_URL`; Admin → `VITE_MERCUR_ADMIN_URL` (no SPA portals).

### 3.2 Full screen map (complete product)

| Screen | Purpose | Key UX jobs |
|--------|---------|-------------|
| **Home** | Discover | Search, categories, rails, trust strip, seller CTA external |
| **Search results** | Find | Query, filters, sort, empty “no results” |
| **PLP / Browse** | Browse category | Facets, sort, grid, pagination/infinite |
| **PDP** | Decide | Gallery, price GHS, seller, stock honesty, delivery blurb, sticky ATC |
| **Seller store** | Trust seller | Logo/name/bio from API, their products |
| **Cart** | Review | Lines, qty, seller group, shipping estimate honesty, COD CTA |
| **Checkout** | Convert | Progress, address, shipping options from API, payment method honesty |
| **Payment pending** | MoMo async | Only when MoMo product-ready; approve-on-phone + poll |
| **Order confirmation** | Relief | Human order label, total, next steps |
| **Orders list** | Track | Filters, status chips, empty state |
| **Order detail** | Support | Timeline, address, items, help CTA |
| **Account** | Profile | Name, addresses, password honesty |
| **Addresses** | CRUD | Ghana-friendly form |
| **Auth** | Session | Login / register short forms |
| **Help / legal** | Trust | FAQ, terms, privacy |
| **404 / errors** | Recovery | Retry + go home |

**Out of buyer SPA forever:** admin, vendor inbox, promotions CMS, inventory tools.

---

## 4. Screen-by-screen UX specs

### 4.1 Global chrome

```
[Logo]  [Search…………………]  [Account]  [Cart · n]
```

Mobile:

```
[Logo]          [Cart]
[Search full width]
Optional bottom nav: Home | Search | Cart | Orders
```

| Element | Behavior |
|---------|----------|
| Search | Submit → results; suggest later (API only) |
| Cart badge | Live cart qty; 0 hides number or shows empty |
| Location chip | Optional later — only if region/city from customer preference API |
| Trust strip (optional) | Lab: “COD · GHS · Multi-vendor” — honest, no fake “free 2-day” |

### 4.2 Home

**Modules (order fixed for scannability):**

1. **Announcement** — one message (promo or lab honesty)  
2. **Hero** — value prop + primary CTA → browse  
3. **Categories** — from product-categories API; if empty, hide section (don’t invent)  
4. **Product rail(s)** — from products API  
5. **Trust grid** — 3–4 real policies (COD, GHS, sellers, delivery honesty)  
6. **Seller CTA** — external Mercur register  

**Empty catalog:** full-page honest empty (“No products yet”) + Sell link — never fake tiles with prices.

### 4.3 Search & PLP

| Control | Best practice |
|---------|----------------|
| Results count | “12 results for …” |
| Sort | Price, newest — only if API supports |
| Filters | Category, price range — only real facets |
| Grid | 2-col mobile, 3–4 desktop |
| Card | Image (aspect locked) → price → title → **Sold by** → rating if any → ATC |
| Infinite / pages | Prefer pagination first (predictable on slow networks) |

**Multi-vendor card meta (critical):**

```
[ image ]
GH₵ 45.00
Golden Palm Cooking Oil 1L
Sold by Tema Fresh Goods
[ Add to cart ]
```

If vendor name missing from API → omit line (don’t invent).

### 4.4 PDP (highest conversion surface)

**Layout (mobile top → bottom):**

1. Image gallery (swipe; first image LCP)  
2. Title  
3. **Price** (GHS, large)  
4. Sold by (link to store)  
5. Short description  
6. Delivery / returns honesty (static policy or API)  
7. Sticky footer: **Add to cart** / **Buy now**  

**Desktop:** gallery left, buy box right (sticky).

**Rules:**

- ATC disabled only if no `offer_id` or out of stock **from API**  
- No fake “Only 2 left”  
- No horizontal tabs for description on mobile — stack  

### 4.5 Cart

| Element | Spec |
|---------|------|
| Line item | Image, title, seller, unit price, qty stepper, remove |
| Multi-seller | Group by seller when cart has multiple (Mercur) |
| Totals | Subtotal from API; shipping “at checkout” until calculated |
| CTA | Primary: Proceed to checkout |
| Secondary | Continue shopping |
| Empty | Illustration + browse CTA |

**Add-to-cart feedback:** toast or mini confirmation; update badge without full reload.

### 4.6 Checkout (Baymard-aligned, Ghana-shaped)

**Goal:** shortest honest COD path first; MoMo only when product-ready.

```
Step indicator: Address → Delivery → Payment → Place order
(or single page with clear sections on mobile)
```

| Section | Fields (minimize) |
|---------|-------------------|
| Contact | Email (prefill from session) |
| Address | First, last, phone, address line, city, region, country (from region API) |
| Optional | Landmark / GhanaPost GPS |
| Shipping | **Radio list from API** shipping options (flatten seller map); show price if returned |
| Payment | **COD** supported; MoMo only if feature + spine ready |
| Review | Items summary + total |

**Mobile keyboard:** `type="email"`, `inputMode="tel"` for phone, large Place order sticky in thumb zone.

**Trust beside CTA:**

- “Cash on delivery — pay when you receive”  
- Link to returns/help (one line)  
- When MoMo live: “Secured by Paystack” + network badges  

**Errors:** field-level + summary; never silent fail.

### 4.7 MoMo payment pending (future product path)

Only when money spine is done:

1. Clear “Approve the prompt on your phone”  
2. Network + masked phone  
3. Amount GHS  
4. Auto-poll status (no fake success)  
5. Timeout → retry or switch to COD if policy allows  

### 4.8 Order confirmation & history

| Screen | Spec |
|--------|------|
| Confirmation | Order **label** (`display_id` preferred; else honest short ref — never invent serial numbers) |
| | Total, payment method, delivery city, items |
| | Primary: View order; Secondary: Continue shopping |
| List | Status chips: Processing / Shipped / Delivered / Cancelled (map from API statuses) |
| Detail | Timeline if data exists; address; items; Help CTA |

### 4.9 Account & auth

| Flow | Spec |
|------|------|
| Register | Email, password, optional name — then customer create |
| Login | Email, password; transfer cart on success |
| Addresses | List + add/edit with same Ghana form |
| Password change | Only if Medusa supports; else honest “not available” |

### 4.10 Seller store page

- Header: name, bio, logo **from API**  
- Product grid of that seller (filter by seller if API allows; else document gap)  
- No fake ratings  

### 4.11 Help & empty/error system

| State | Pattern |
|-------|---------|
| Loading | Skeleton cards (shadcn-friendly), not spinners only |
| Empty catalog | Honest + sell CTA external |
| Empty cart | Browse CTA |
| Empty orders | Sign-in / place COD explanation |
| API error | Message from error + Retry |
| 404 | Home + search |

---

## 5. Multivendor trust model (cross-cutting)

```text
Every commercial surface shows, when data exists:
  1. Price in GHS
  2. Sold-by seller
  3. Availability honesty (in stock / unavailable)
  4. Delivery: “options confirmed at checkout” until quoted
```

**Never:**

- Fake free shipping banners  
- Fake review counts  
- Stock counts unless API provides  
- Crossed-out “was” prices unless compare-at from API  

---

## 6. Content & tone (Ghana English)

| Do | Don’t |
|----|--------|
| “Pay when you receive (cash on delivery)” | “SNAP”, “Rollback”, US-only jargon |
| “Sold by {seller}” | Hide vendor identity |
| “Approve MoMo on your phone” | “Processing payment…” without instruction |
| “GH₵” or API currency | Ambiguous “$” |
| Short sentences, mobile readable | Dense legal walls on checkout |

---

## 7. Component inventory (build order for `apps/storefront`)

### 7.1 L1 shadcn (add as needed via CLI)

Button, Input, Label, Textarea, Select, Checkbox, RadioGroup, Card, Badge, Skeleton, Sheet, Dialog, DropdownMenu, Separator, Tabs, Sonner/Toast, Form (RHF+Zod).

### 7.2 L2 domain (must exist for full UX)

| Component | Used on |
|-----------|---------|
| `AppHeader` / `MobileNav` | Global |
| `SearchField` | Header, home |
| `ProductCard` | Home, PLP, seller, search |
| `ProductGallery` | PDP |
| `Price` | Everywhere money |
| `SellerChip` | Card, PDP, cart |
| `AddToCartButton` | Card, PDP |
| `CartLineItem` | Cart |
| `OrderSummary` | Cart, checkout |
| `AddressFields` | Checkout, account |
| `ShippingOptionList` | Checkout |
| `PaymentMethodList` | Checkout |
| `CheckoutStepper` | Checkout |
| `OrderRow` / `OrderStatusBadge` | Orders |
| `EmptyState` | All lists |
| `ErrorState` | Fail closed |
| `LabBanner` (optional) | Until production claims allowed |

### 7.3 Data hooks (no hardcodes)

```text
useProducts, useProduct, useCart, useAddOffer,
useCheckoutCod, useShippingOptions, useOrders, useOrder,
useSession, useRegionCountries, useSellerBySlug
```

All IDs from API or user input; config from env only.

---

## 8. Flows (happy paths)

### 8.1 First purchase (COD) — **definition of complete buyer UX v1**

```text
Land home → search/browse → PDP → Add to cart → Cart
→ Checkout (address + shipping option from API + COD)
→ Confirmation with order label → Orders list (if signed in)
```

### 8.2 Returning buyer

```text
Sign in → cart transfer → reorder from order detail (later) → checkout faster (saved address)
```

### 8.3 Multi-seller cart (v2 when catalog supports)

```text
Cart grouped by seller → one shipping method per seller group → single place order
→ order(s) / order group per Mercur model — UI must match API shape, not invent single order
```

### 8.4 Seller journey (Mercur — UX requirements only)

| Step | UX note |
|------|---------|
| Register | Clear path from SPA “Sell” link |
| Approval wait | Honest status in Mercur |
| List product | Mercur forms |
| Fulfill | Status updates buyers see on order detail |

Buyer SPA only deep-links; does not rebuild.

---

## 9. Phased delivery (aligned to greenfield storefront)

| Phase | UX scope | Exit criteria (browser) |
|-------|----------|-------------------------|
| **P0** | Shell, tokens, fail-closed env | App loads |
| **P1** | Home catalog + ProductCard | Products from API |
| **P2** | Cart + offer_id + COD checkout + order confirm | Full COD purchase |
| **P3** | PDP + seller chip + PLP/search | Discover → decide → cart |
| **P4** | Account, addresses, orders polish | Self-service basics |
| **P5** | Multi-seller cart grouping | 2 sellers in one cart |
| **P6** | MoMo UI (pending + trust) | Only after payment spine |
| **P7** | Performance, a11y audit, CWV | Lighthouse/mobile pass bar |

**Current greenfield:** P0–P2 largely scaffolded; **P3 (PDP) started**; P4–P7 not done.

---

## 10. Success metrics (when live traffic exists)

| Metric | Target direction |
|--------|------------------|
| Mobile checkout completion | ↑ after form cut |
| Add-to-cart rate on PDP | ↑ with sticky CTA |
| Cart abandonment | ↓ vs baseline |
| Time to first order (new user) | ↓ |
| Support tickets “where is vendor/delivery” | ↓ with sold-by + honesty |
| CWV LCP (mobile) | < 2.5s on key templates |

Until production traffic: use **scripted browser DoD** per phase, not vanity curls alone.

---

## 11. Anti-patterns (explicit ban)

| Ban | Why |
|-----|-----|
| Dual-home admin/vendor in SPA | Kills focus; duplicates Mercur |
| Fake catalog/prices for demos | Destroys trust + violates no-magic |
| Claiming MoMo ready in UI while spine incomplete | Mode B / honesty |
| Guest COD without saying orders may not attach | Confusing empty orders |
| Decorative yellow everywhere | CTA fatigue; hierarchy dies |
| Horizontal tab walls on mobile PDP | Baymard: content hidden |
| Auto-open keyboard on checkout load | Mobile conflict |
| Invented order numbers | Use display_id or honest ref |

---

## 12. Relationship to other docs

| Doc | Role |
|-----|------|
| This plan | **Complete buyer UX vision + practices** |
| `2026-07-16-greenfield-mercur-shadcn-plan.md` | Engineering architecture |
| `2026-07-16-no-hardcodes-no-magic.md` | Data integrity rules |
| `2026-07-16-mode-b-lab-demo-freeze.md` | What we claim today |
| `2026-07-16-ghana-storefront-ui-redesign.md` | Brand/token lock + Ghana pillars |
| Walmart hierarchy spec | Card/PLP attention order (adapt, don’t clone US) |

---

## 13. Recommended next implementation slice

**Do not open all phases at once.** Next concrete UX slice for `apps/storefront`:

1. **SellerChip + price component** (trust on card/PDP)  
2. **PLP/browse route** with real empty/filter states  
3. **Sticky mobile ATC on PDP**  
4. **Checkout field reduction + sticky place-order**  
5. **Order confirmation polish** (label, next steps)  
6. **A11y pass** on checkout  

Only after COD browser DoD is smooth: multi-seller grouping, then MoMo UI.

---

## 14. Summary

A modern multivendor ecommerce UX for Alkemart is:

| Pillar | Practice |
|--------|----------|
| **Mobile-first Ghana market** | Thumb CTAs, data-light, GHS, COD/MoMo honesty |
| **Marketplace trust** | Sold-by everywhere data exists |
| **Short checkout** | Baymard-style field minimization |
| **Clear roles** | Buyer shadcn SPA · Seller/Admin Mercur |
| **Honest system** | No hardcodes, no fake catalog, fail closed |
| **Component system** | shadcn L1 + domain L2 only |

This plan is the UX “north star.” Execution continues on **`apps/storefront`** (single port **5175**), not by reopening dual-home architecture.
