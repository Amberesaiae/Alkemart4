# Mowafer — deep architecture & flow analysis

**Source:** `ui/` Behance packs (local) + project brief on Behance  
**Product (official brief):** *Price comparison + e-commerce platform (Egypt)* — best **online and offline** grocery/electronics prices to the doorstep.  
**Not:** single-warehouse Amazon; not Walmart. **Multi-retailer comparison is core identity.**

Local folder is a **partial export**. Behance gallery `95225945` lists more modules (e.g. wireframes `3e2590…`, `7c461e…`) not present on disk. Analysis below is limited to what is actually in `ui/`.

---

## 0. What Mowafer is (product thesis)

| Layer | Meaning |
|-------|---------|
| **Discovery** | Find products across categories (grocery + electronics + more) |
| **Comparison** | On PDP: **Other Prices / Retailers** (Jumia, Souq, Noon, local stores) |
| **Commerce** | Own cart + checkout (COD, cards, **loyalty points**) |
| **Delivery** | Address + **delivery method** (standard vs check-points) + **time slots** (mobile) |
| **Content** | Articles / blog as secondary IA branch |
| **Locales** | EN (Montserrat) + AR (Cairo) — bilingual by design |

Alkemart mapping later must treat **multi-seller / multi-offer** as analogous to Mowafer’s multi-retailer prices — not ignore it as decoration.

---

## 1. Pack inventory (what we have)

### A. Web: `E-Commerce Platform _ Mowafer __ Behance/`

| Board (unique) | Content |
|----------------|---------|
| `imgi_10` | Cover + **full homepage scroll** |
| `imgi_11` | **Category listing** (pet care) + filter chrome + product cards |
| `imgi_12` | **Category listing** (food + electronics variants) + brand rail |
| `imgi_13` | **Cart + multi-step checkout** (address → delivery → payment → success) |

Duplicates `imgi_51–54` = same files.

### B. App: `MOWAFER E-Commerce App UI_UX Design __ Behance/`

| Board | Content |
|-------|---------|
| `imgi_9` / `imgi_50` | **01 Information architecture** (4 levels) |
| `imgi_10` / `imgi_51` | **02 User journey** + **03 Design guidelines** |
| `imgi_12` / `imgi_53` | **Mobile screens:** splash, home, deals, account, PDP + compare |
| `imgi_14` / `imgi_55–56` | **Mobile checkout:** cart → address → payment → slots → done |

Missing on disk vs Behance: extra modules (wireframes / more screens).

---

## 2. Information architecture (complete tree from board 01)

```
Home Page
│
├── Featured Offers ──────────────► Product Page ──┬── Comparison
│                                                   ├── Cart ──────────────┐
├── All Categories ───────────────► Product Page ──┘                      │
│                                                                         ▼
│                                                              Checkout (L4)
│                                                              ├── Shipping Address
│                                                              ├── Delivery Method
│                                                              └── Payment Method
│
├── Account Page
│     ├── Log in  ──┐
│     └── Sign Up ──┴──► (can merge into cart/checkout path)
│           └── Account Settings ──► Points (loyalty)
│
├── Wishlist
│
├── Customer Care
│     ├── FAQ
│     ├── Privacy Policy
│     └── Terms & Conditions
│
├── Articles  (content / magazine)
├── About Us
└── Contact
```

**Depth:** 4 levels (Home → domain → product/commerce → checkout steps).  
**Key fork on Product:** Comparison *or* Cart (or both: wishlist / compare then cart).

---

## 3. User journey (board 02 — full graph)

### 3.1 Primary commerce path (happy path)

```
Home
  ├─ Latest Offers ──┐
  ├─ Best Sellers ───┼──► Product Page ──► Product Info
  └─ All Categories ─┘         │
         │                     ├─ Add To Wishlist
         │                     ├─ Add To Compare
         │                     └─ Add To Cart  ★ (highlighted)
         │
         ▼
   Category Page ──► Product Page (same as above)
         │
         ▼
   Shopping Cart ──────────────────────────────┐
                                               ▼
                                         Checkout
                                               ├─ Log In / Sign Up (if guest)
                                               ├─ Add Address
                                               ├─ Payment
                                               └─ Done
```

### 3.2 Secondary paths

| Entry | Path | End |
|-------|------|-----|
| Wishlist | Edit / Remove / Update | (can re-enter cart) |
| Account | Log In / Sign Up → Account Settings → My Points | Loyalty |
| Articles | Listing → Article inner | Content |
| About | About Mowafer / Our Services | Brand |
| Contact | Mail / Call | Support |

**Journey rule:** Product is the hub; **Add to Cart is the golden action**; checkout is gated by auth optionally (guest path implied by separate login node).

---

## 4. Design system (board 03 — exact)

### 4.1 Color

| Role | Hex | Usage |
|------|-----|--------|
| Primary yellow | `#FEBF31` | Logo tile, CTAs, cart buttons, app chrome, success accents |
| Primary dark | `#3C3C3B` | Body text, dark UI chrome |
| Cat · Electronics | `#50D1C8` teal | Category panels / icons |
| Cat · Food | `#FEBF31` yellow | Same as primary |
| Cat · Home & Pet | `#F0295A` pink/red | Category panels (web listing left rail) |
| Cat · Beverages | `#9AC63B` green | Icons / accents |
| Cat · Health | `#3C3C3B` dark | Icons |
| Cat · Baby | `#F5F5F5` light gray | Icons / soft surfaces |

### 4.2 Typography

- **Latin:** Montserrat family  
- **Arabic:** Cairo family  
- Dual-script product from day one (web + app show Arabic labels e.g. language `عربي`)

### 4.3 Icon system

Primary category icons (line style): Electronics · Food · Beverages · Home & Pet · Health · Baby  

### 4.4 Component language

- Soft white cards, large radius (~12–16px visual)  
- Pill / rounded yellow primary buttons  
- Floating product mini-cards  
- Colored **side filter panels** (not gray Amazon filters)  
- App: yellow top app bar; bottom tab bar  

---

## 5. Web architecture (screens & layout recipes)

### 5.1 Global chrome (all web pages)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo yellow]  [Search .................. 🔍]  Home About  │
│                Last Offers Contact   [lang] [user] [cart]   │
├─────────────────────────────────────────────────────────────┤
│ [icon] Electronics | Food | Beverages | Care | Pet | Baby   │  ← category icon rail
└─────────────────────────────────────────────────────────────┘
```

- Search placeholder: “Find Your Products with best Price” → **price-comparison framing**  
- Nav is marketing-site + shop hybrid (About / Contact on same bar as shop)

### 5.2 Homepage (imgi_10) — full scroll architecture

| Section | Structure | Flow purpose |
|---------|-----------|--------------|
| **S1 Category mosaic** | 4 large tiles: Pets (red), Food (yellow), Cosmetics (pink), Electronics (teal) | Fast entry to category |
| **S2 Last Offers** | Filter chips (icons) + grid/list toggle + product grid + yellow cart on card + “View More” | Merchandising / deals |
| **S3 Delivery story** | Copy + world map + parcel illustrations + “Shop Now” | Trust / logistics brand |
| **S4 Advertise With Us** | Yellow band + email/phone + Subscribe | B2B / seller acquisition |
| **S5 Footer** | Logo, payment icons, category columns, quick links, copyright | SEO + legal |

**Home is not “search-only Amazon.”** It is: **category theater → offers grid → trust → grow marketplace.**

### 5.3 Category / PLP (imgi_11, imgi_12) — full chrome

```
Header + icon rail
Hero: headline + lifestyle image (category-specific)
Filter bar: Category radios | Average Rating stars | Price range | grid/list toggle
Body:
  LEFT: Categories panel (color-coded by department) + Brands panel (gray)
  MAIN: product cards (image, title, stars, price, yellow cart)
  FLOAT: featured product card (optional)
Footer
```

**Filter model:**
- **Category** (subcats of current department)  
- **Average rating** (star thresholds)  
- **Price** (range control)  
- **Brands** (checkbox list)  
- **Layout mode** (grid vs list)

Category panel **color changes by department** (pink pet, yellow food, teal electronics) — brand system is category-chromatic.

### 5.4 Cart & checkout (imgi_13) — step machine

**Cart table**

| Columns | Behavior |
|---------|----------|
| Products (thumb + title + category tag color) | Line identity |
| Price | Unit |
| Count | Steppers − / + |
| Subtotal | Line total |
| **Total** | Cart total |

**Checkout steps (stepper icons):**  
1. Location pin → **Address Details** (name, city, phone, address, Add Address)  
2. Rocket → **Delivery Method** (Standard Shipping vs Our Check Points + note “Delivered by Monday 2 Sep”)  
3. Card → **Payment Method**  
   - Cash On Delivery  
   - Debit and Credit Cards (Visa/MC/PayPal marks)  
4. Success → checkmark “Your Order Has Confirmed” + Track Your Order  

**Architecture insight:** Checkout is a **linear state machine**, not one long form. Cart is separate from checkout steps.

---

## 6. Mobile architecture (screens)

### 6.1 Navigation shell

**Bottom tabs (recurring):**  
Home · (Orders/heart) · Search · Account  

**Top bar:** yellow · logo · cart · search field  

### 6.2 Screen catalog from boards

| Screen | Elements | Outgoing actions |
|--------|----------|------------------|
| **Splash / onboarding** | Yellow/teal, logo, grocery art, “Grocery From One Place” | Enter app |
| **Home** | Category icon grid, Deals Of The Day, Top Selling Items, bottom nav | Category, PDP, search, account |
| **Deals Of The Day** | Full deals grid + category chips | PDP |
| **Account** | Orders, Wishlists, Points, Pending Reviews; Settings (General, Security, Address, Language عربي); Sign out; footer links | Orders, wishlist, settings |
| **PDP** | Image, title, brand, price EGP, qty, Specs / Reviews tabs, **Other Prices / Retailers table**, Add to Cart, cart/heart/share | Cart, wishlist, compare retailers |
| **Cart** | Lines, wishlist per line, remove, delivery fee lines, Place Order | Checkout |
| **Checkout · Address** | Name, address, phone, Add New Address, totals, Place Order | Payment |
| **Checkout · Delivery fees** | Electronics cart delivery fee + Grocery delivery fee + **day/time slots** | Payment |
| **Checkout · Payment** | COD radio, Mowafer Points slider (loyalty), Confirm | Done |
| **Done** | Success cart illustration, My Orders | Orders |

### 6.3 Multi-retailer comparison (critical)

PDP shows **Other Prices / Retailers**:

| Retailer | Price (example) |
|----------|-----------------|
| Jumia | … |
| Souq | … |
| Noon | … |
| Cairo Sales Stores | … |

This is **price-comparison platform** behavior. Flow:

```
Product discovered on Mowafer
  → See Mowafer offer price
  → Optionally compare external retailers
  → Still purchase via Mowafer cart (primary) OR understand market (secondary)
```

For Alkemart: closest native concept is **multi-seller offers on one product** (Mercur offers), not scraping Jumia.

### 6.4 Cart economics (mobile)

Totals include:
- Subtotal  
- Electronics Cart Delivery Fees  
- Groceries Cart Delivery Fees  
→ **Category-based shipping** (not one flat fee)

Place Order → multi-step checkout with COD + points.

---

## 7. End-to-end flows (must implement to “get” Mowafer)

### Flow A — Browse & buy (web)

```
Land Home
 → Tap Food category tile OR icon rail
 → PLP with pink/yellow/teal side filters
 → Adjust brand / rating / price
 → Add to cart from card (yellow)
 → Cart table edit qty
 → Checkout: Address → Delivery method → COD/Card → Success → Track
```

### Flow B — Deals path (mobile)

```
Splash → Home
 → Deals Of The Day
 → PDP
 → See other retailers (compare)
 → Add to Cart (toast “1 Item Added To Cart”)
 → Cart → Place Order → Address → Delivery slots → COD + Points → Confirm → Done → My Orders
```

### Flow C — Account / loyalty

```
Account → Points / Wishlist / Orders / Pending Reviews
 → Language AR/EN
 → Address book
```

### Flow D — Content (lighter)

```
Home → Articles → Article detail
Home → About / Contact / Customer Care (FAQ, Privacy, Terms)
```

### Flow E — Marketplace growth

```
Home → Advertise With Us (email/phone subscribe)  [web B2B lead]
```

---

## 8. Domain model implied by UI (entities)

| Entity | Evidence in UI |
|--------|----------------|
| **User** | Account, login, language, addresses |
| **Product** | Title, brand, images, specs, ratings, category |
| **Category / Subcategory** | Icon rail + side lists + colored panels |
| **Brand** | Brand filter panel |
| **Offer / Price** | Card price; multi-retailer table |
| **Retailer / Seller** | Other Prices list; multi-seller analogy |
| **Cart / Line** | Qty, category-colored tags, delivery fee by cart type |
| **Wishlist** | Heart, account list, cart “add to wishlist” |
| **Compare list** | Add To Compare on journey |
| **Order** | Success, My Orders, track |
| **Delivery method** | Standard vs Check Points; time slots |
| **Payment method** | COD, cards |
| **Loyalty points** | “Use Mowafer Points” with balance |
| **Article** | Content branch |
| **Advertiser lead** | Advertise With Us form |

---

## 9. What I under-specified before (corrections)

| Earlier shortfall | Full reading |
|-------------------|--------------|
| Treated as “pretty yellow grocery UI” | It’s **price comparison + e-commerce** (Behance brief + retailer table) |
| Focused on home/listing only | Full **4-level IA** + **loyalty points** + **compare** + **articles** + **advertise** |
| Checkout as one page | **Stepped machine**: address → delivery (method/slots) → payment → done |
| Single delivery fee | **Split fees** electronics vs grocery |
| Filters as Amazon gray | **Category-colored side panels** + rating + price + brands |
| Mobile as responsive web | Separate **app shell** (tabs, yellow chrome, toasts) |
| Assumed full pack local | **Incomplete export** vs Behance modules |

---

## 10. Alkemart mapping (architecture-level)

| Mowafer concept | Alkemart native | Gap |
|-----------------|-----------------|-----|
| Multi-retailer prices | Multi-**seller offers** on product | Build PDP “other sellers/offers” not external Jumia scrape |
| Category icon rail | Categories API | UI only |
| Colored category filters | Frontend theme map per category | UI |
| Last Offers / Deals | Featured / sellable catalog | Merchandising rules |
| COD | Existing COD path | Align UX steps |
| Loyalty points | None | Defer or stub |
| Wishlist / Compare | None | Defer v1.1+ |
| Articles | None | Defer |
| Bilingual AR | Language select partial | Real AR copy later |
| Check-point delivery | Shipping options | Map to Medusa/Mercur shipping |
| Time slots | None | Defer or simple options |
| Advertise With Us | Sell on alkemart / partners | Copy + form |

---

## 11. Recommended Alkemart target architecture (Mowafer-shaped)

```
Storefront (responsive web first; app patterns for mobile breakpoints)

Chrome
  Logo · Search (“best price” framing → multi-seller) · Nav · Cart · Account

Home
  Category mosaic (color tiles)
  Icon category rail
  Last Offers / Featured grid (yellow cart)
  Delivery trust
  Sell/Advertise CTA
  Footer

PLP / Search
  Hero + filter bar (category, rating*, price*, brands*)
  Left: subcategories + brands
  Grid: cards with yellow add
  *rating/brands only if data exists — never fake

PDP
  Media · info · buy
  “Other sellers / offers” (Mercur multi-offer)  ← Mowafer comparison soul
  Add to cart

Cart
  Lines · qty · fees (by seller/shipping when available)

Checkout (stepper)
  1 Address
  2 Delivery method (+ slot if available)
  3 Payment (COD primary; card later)
  4 Success + order id

Account
  Orders · addresses · (wishlist later)
```

---

## 12. Feasibility (revised, architecture-aware)

| Slice | Achievable on Alkemart now? |
|-------|----------------------------|
| Visual system (yellow #FEBF31-ish, dark #3C3C3B, soft cards, category colors) | **Yes** |
| Home mosaic + icon rail + offers grid | **Yes** |
| PLP filters UI + left panels | **Yes** (data-backed fields only) |
| Cart + stepped checkout + COD | **Yes** (align existing checkout) |
| Multi-offer “other sellers” on PDP | **Yes if offers API exposes peers** — core Mercur idea |
| Loyalty points / wishlist / compare / articles | **Not v1** without new domains |
| True external price comparison (Jumia scrape) | **No / non-goal** for alkemart |
| Full AR bilingual | **Partial** |
| Pixel-perfect Behance clone | **No** — adapt system, keep brand alkemart |
| Complete pack (missing Behance boards) | **Incomplete inputs** — download remaining modules if wireframes needed |

**Verdict:** We can achieve a **faithful Mowafer-shaped multi-seller commerce architecture** (IA + journeys + visual system + multi-offer PDP + stepped COD checkout). We cannot achieve every secondary branch (points, compare list, articles, external scrapers) without new product scope.

---

## 13. Suggested implementation order (architecture-driven)

1. **Tokens** — Mowafer palette + type + radii  
2. **Chrome** — header, icon category rail, footer  
3. **Home** — mosaic → offers → trust → sell CTA  
4. **PLP** — filter bar + colored left nav + cards  
5. **PDP** — buy + **other sellers/offers**  
6. **Cart + stepped checkout** (address → delivery → COD → success)  
7. **Account orders/addresses**  
8. Backlog: wishlist, points, articles, AR copy, time slots  

---

## 14. Action if pack is incomplete

Optional: pull remaining Behance modules (`3e2590…`, `7c461e…`, cover) into `ui/` so wireframes are not missing. Architecture above still stands from IA + journey + shipping screens.

---

*This document supersedes Amazon/Walmart-first planning for storefront direction. Source of truth: Mowafer boards in `ui/` + Behance product brief (price comparison + e-commerce).*
