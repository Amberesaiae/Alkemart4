# UX overhaul — marketplace surfaces

**Status:** plan, nothing implemented
**Benchmarks:** Hubtel consumer app (primary), Walmart web (grid + promo discipline), Amazon Stores (vendor shop discipline)
**Scope:** storefront home, category system, product card, PDP, stores index, store page, plus the vendor and admin controls that feed them

---

## 0. What I actually looked at

**Hubtel** — `hubtel.com/app` runs a live-data replica of the consumer app home screen. I captured it at 1280px. What is directly observable:

- **Header:** logo · `Deliver to / Kokomlemle ⌄` (location is the second thing on the page, before search) · a wide pill search with a *filter* glyph inside the field · primary nav `Home · Stores · Purchases · Account`. A utility strip above carries `Sell on Hubtel` / `Ride on Hubtel` / `GET THE APP`.
- **Service rail:** circular white tiles with a full-colour brand glyph and a short label (SMS, Approvals, MTN, Telecel, ECG, AirtelTigo, Send to Bank, Car Insurance, Bet Topup, Ghana Water, DSTV, GOTV, Startimes). Horizontally scrolled with `‹ ›` chevrons. This is the app's *verb* rail — "what do you want to do" — not a taxonomy.
- **Shelves:** `Most Ordered`, `Trending` — each a titled carousel with its own `‹ ›` controls. The **first slot of a shelf can be a promo tile** ("TELL YOUR RIDER WHAT WORKS FOR YOU") rendered at 2× card width, inline, sharing the scroll. Promo is *inside* the merchandise, not stacked above it.
- **Product card:** square image, floating circular `+` on the image (top-right), then title (bold, near-black), **vendor name on its own line in brand orange**, price in bold brand red, and `★ 3.7 (20)`. Four facts, one tap target, vendor always named.
- **Nav model:** `Home / Stores / Search / Purchases / Account` — Stores is a *peer of Home*, not a footer link.

The public site does not expose the in-app **Stores** list or a store detail page (`/consumer/stores` is a marketing page). So the store-card spec below is built from: the home screen I did capture, the behaviour you described (rating, "10 min / 20 min" ETA, vendor-curated top items), and standard marketplace practice. **Flagged as assumption where it matters.**

**Walmart**, for the parts you named:
- Category entry is **art-led tiles in a bento/mosaic**, labels burned into a consistent band, never an icon-only grid.
- Promo **grids** (2×2 / 3×1 of equal-weight campaign tiles, each a single destination) are a distinct unit from promo **bands** (full-bleed one-message strips). You already model both.
- Shelves are strictly `4 desktop / 2 mobile` and every shelf has a real "view all" destination.

---

## 1. Gap audit — verified against the codebase

| Area | Today | Evidence |
|---|---|---|
| **Homepage sections** | Strong. 9 section types, draft/publish/schedule, per-section windows, shared primitives between Studio and storefront. | [homepage-merchandising.md](docs/architecture/homepage-merchandising.md), [merchandising.tsx](packages/ui/src/merchandising.tsx) |
| **Product card rating** | `ratingAvg` / `ratingCount` **already on the type and hydrated**, but the tile never renders them. | [products.ts:46](apps/storefront/src/lib/products.ts:46), [product-card.tsx](apps/storefront/src/components/product-card.tsx) |
| **Card add-to-cart** | Icon button in the footer row, competing with price for space. Hubtel floats it on the image. | [product-card.tsx](apps/storefront/src/components/product-card.tsx) |
| **Stores index** | Bare. Letter-avatar, name, bio, "Visit store →". No rating, no ETA, no open/closed, no product preview, no search, no sort, no filter. | [shops.index.tsx](apps/storefront/src/routes/shops.index.tsx) |
| **Stores list API** | Returns `{ id, handle, name }` only. | [store/sellers.ts:11](apps/api/src/routes/store/sellers.ts:11), [catalog-repository.ts:263](apps/api/src/catalog-repository.ts:263) |
| **Store detail API** | Rich — `trust` carries `ratingAvg`, `ratingCount`, `salesCount`, `memberSince`, `location`, `hours`, `social`, `announcement`, `policy`, `recentReviews`; plus `availability {open,paused}` and `featuredProductIds`. | [store/sellers.ts:19-46](apps/api/src/routes/store/sellers.ts:19) |
| **Vendor-curated top items** | **Already built** — `MAX_FEATURED = 8`, vendor `GET/PUT` endpoints, and a batch reader `listFeaturedForShops(sellerIds)` that **nothing currently calls**. | [shop-featured.ts:5](apps/api/src/shop-featured.ts:5), [vendor/sellers.ts:601](apps/api/src/routes/vendor/sellers.ts:601) |
| **Delivery ETA** | **Does not exist.** Only `deliveryFeePesewas` on the seller. No prep time, no travel estimate, no zone. | grep: `deliveryFee*` across `packages/domain`, `packages/db`, `apps/api` |
| **"Deliver to" location** | No header location control. Markets/regions exist for *checkout address*, not as a browsing context. | [AppHeader.tsx](apps/storefront/src/components/shell/AppHeader.tsx), [markets.ts](apps/storefront/src/lib/markets.ts) |
| **Category entry** | Text-chip rail in the header (`CategoryIconRail` is chips, not Hubtel's circular art tiles) + a `category_grid` mosaic on home. Two systems, neither is the fast "verb rail". | [CategoryIconRail.tsx](apps/storefront/src/components/shell/CategoryIconRail.tsx) |
| **Mobile nav** | `BottomBar` exists but is a generic action slot (`fixed … md:hidden`), not a 5-tab app nav. | [bottom-bar.tsx](apps/storefront/src/components/bottom-bar.tsx) |
| **Search** | Header form → `/search`. No suggest-as-you-type, no inline filter affordance, no scoped "search this shop" outside the store page. | [AppHeader.tsx:56](apps/storefront/src/components/shell/AppHeader.tsx:56) |

**Headline:** the merchandising engine is ahead of the surfaces it feeds. The biggest wins are *exposing data that already exists* (ratings on cards, featured items on store cards) and *one genuinely new data concept* (delivery ETA). Only after that does anything need a redesign.

---

## 2. Design thesis

Three ideas, in priority order.

**(a) Every card answers "can I trust this and when do I get it?" before it answers "what is it?"**
A multi-vendor marketplace's core anxiety is not selection, it's *which of these strangers should I buy from*. Hubtel answers it on every tile — vendor named, rating shown, ETA shown. Today Alkemart names the vendor but hides the rating it already has and has no ETA at all. This is the single highest-leverage change in the document.

**(b) Stores are a destination, not a directory.**
Your instinct is right: for a multi-vendor platform, `Stores` belongs beside `Home`. A store card that shows *the vendor's own eight best items* turns a list of names into a browsable market. And it costs almost nothing — `listFeaturedForShops` was written for exactly this and is sitting unused.

**(c) Two rails, two jobs — do not merge them.**
Hubtel's circular rail is **verbs** (pay ECG, top up MTN). Walmart's mosaic is **nouns** (Groceries, Home, Health). Alkemart currently has one ambiguous chip rail doing neither well. Split it: a **Quick-actions rail** (Near me · Under ₵50 · Free delivery · Fastest delivery · Top rated · Pay on delivery) directly under the header, and keep the art-led `category_grid` mosaic as the taxonomy entry on home. The quick rail is a *filter launcher*, which is what Hubtel's rail actually is functionally.

---

## 3. Workstreams

Each is independently shippable. `[API]` marks backend work, `[DATA]` a schema change.

### W1 — Trust on the product card *(no new data)*

Restructure `ProductCard` tile to the Hubtel four-fact layout:

```
┌─────────────┐
│   image     │ ← floating ⊕ add (top-right), ♡ (top-left), stock badge (bottom-left)
├─────────────┤
│ Title (2ln) │ bold, foreground
│ Vendor name │ brand accent, links to /shops/$slug
│ ₵35.00      │ bold, tabular
│ ★ 4.6 (12)  │ only when ratingCount > 0
└─────────────┘
```

- Render `ratingAvg` / `ratingCount` — already hydrated, currently dropped. Compact form (one star + numeral + count), not the 5-star row; `ProductRating` stays for PDP.
- Move add-to-cart to a floating circular control on the image. Frees the footer row for rating and stops price truncation.
- Keep `from ₵X` when `offerCount > 1` — that is a genuine multi-vendor advantage Hubtel does not have.
- Omit the rating line entirely when there are no reviews. Never render "0 (0)" or a grey 5-star ghost.
- `row` variant inherits the same facts in a single line.

**Cost:** one file. **Risk:** low. **Do this first.**

### W2 — Store cards that sell

`[API]` `GET /store/sellers` returns a card DTO instead of a stub:

```ts
{ id, handle, name, logo, banner,
  ratingAvg, ratingCount, salesCount,
  location,                       // packRegion
  availability: { state, pausedUntil, note },
  etaMinutes: { min, max } | null, // W4
  featured: ProductCardDTO[]       // ≤8, vendor-ordered
}
```

Build it from `listOpenSellers` + `listFeaturedForShops(ids)` + the same rating aggregation `assembleShopTrust` already does — hoist that reduction into a shared helper so list and detail cannot drift. One batched review query for the page of sellers, not N.

Then rebuild `/shops`:

- **Store card:** banner strip or logo + name + `✓` verified · `★ 4.6 (128)` · `📍 Osu` · `🕐 25–40 min` · open/paused pill. Below it, a **horizontal strip of the vendor's featured items** (image + price only, tap goes to PDP). This is the "vendor shows their top items" behaviour you described.
- **Controls:** search shops by name, sort by `Top rated / Fastest / Nearest / Most sold`, filter `Open now`, `Free delivery`, category.
- **Empty and honest:** a shop with no featured picks shows its newest items with no claim of curation; a shop with no reviews shows no rating rather than a zero.

**Cost:** 1 API route + 1 repo method + 1 route rewrite + a shared `StoreCard` in `packages/ui`. **Risk:** medium (query shape). **Highest visible payoff.**

### W3 — Vendor curation UI

`setFeatured` exists; the vendor-side experience should match the promise:

- In `ghana-vendor/src/routes/store.tsx`, a **"Your shop window"** panel: drag-ordered slots showing exactly what buyers will see, rendered with the real `StoreCard` preview (the app already does live preview via `LivePreview` — reuse it).
- Show the cap honestly ("3 of 8 chosen"), and a one-click "fill with my best sellers" using vendor stats.
- **Decision needed:** you said 10, possibly 20, then settled on 10. Code says 8. See §5.

### W4 — Delivery ETA `[DATA]` `[API]`

The one genuinely new concept. Staged so you get value before you get precision:

1. **Seller-declared band.** Add `prep_minutes_min` / `prep_minutes_max` to the seller row, set during onboarding and in vendor settings, validated to a sane range. Surface as `25–40 min` on store cards, store page, PDP offer rows, and cart seller groups.
2. **Zone travel add-on.** A small `delivery_zones` table keyed by region/area with a travel band; buyer's chosen area adds to the seller band. Requires W5.
3. **Observed correction.** Once order timestamps accumulate (`orders` already has the money trail), blend declared vs. actual and flag vendors whose declared band is fiction.

Never show a single number — always a band. A single "10 min" is a promise; `10–20 min` is an estimate, and only the second one survives a bad traffic day.

### W5 — "Deliver to" as browsing context

Header gains a location control left of search (`Deliver to / Osu ⌄`), persisted client-side, defaulting to unset with a soft prompt rather than a blocking modal. It drives: store sort by distance, ETA bands, a "Near you" shelf source, and pre-fills checkout. Reuse `GHANA_REGIONS` from `@alkemart/shared/ghana` for the area list — do not invent a second geography.

**Prerequisite for W4 stage 2.** Ship W4 stage 1 without it.

### W6 — Navigation: Stores becomes a peer

- **Mobile:** promote `BottomBar` to a real 5-tab nav — `Home · Stores · Search · Orders · Account` — matching Hubtel. This is the change that most makes the site feel like an app.
- **Desktop:** `Stores` joins the primary header nav.
- **Quick-actions rail** (thesis c) under the header on home and listing pages: circular tiles, each a pre-applied filter. Reuse `CategoryIconRail`'s scroll/overflow mechanics; new visual treatment (circular, art-led, chevron controls on desktop).
- Keep the `category_grid` mosaic as the taxonomy entry on home — it is already good and already admin-editable.

### W7 — New section types for the Studio

Two additions that follow the existing pattern and need no schema migration (JSONB + Zod, as with the v2 fields):

- **`store_rail`** — a shelf of *stores* rather than products. Sources: `top_rated` / `fastest` / `newest` / `manual`. This is how you merchandise vendors, which a multi-vendor platform needs and Walmart-style product shelves cannot express.
- **`shelf_promo_slot`** — an optional `promoTile` on `product_shelf` / `deal_rail` that renders as a double-width first card inside the scroll, exactly as Hubtel does. Cheaper and better-converting than another stacked band.

Both extend `packages/shared/src/homepage.ts`, `merchandising.tsx`, the Studio section library, and the docs table — a well-worn path in this repo.

---

## 4. Sequencing

| Phase | Contents | Why here |
|---|---|---|
| **1** | W1 (card trust) | One file, no API, immediate lift on every surface |
| **2** | W2 (store cards + API) + W3 (vendor curation) | The multi-vendor identity; unlocks the Stores destination |
| **3** | W6 (nav + quick rail) | Now that Stores is worth visiting, make it reachable |
| **4** | W4 stage 1 (declared ETA) | Needs vendor-settings surface from W3 |
| **5** | W5 (deliver-to) → W4 stage 2 | Geography; largest blast radius |
| **6** | W7 (Studio sections) | Merchandising catches up to the new surfaces |

Phases 1–3 are the ones that change how the product feels. 4–6 are what make it defensible.

---

## 5. Decisions I need from you

1. **Featured cap.** Code enforces 8. You said 10. Raising it is a one-line constant plus the vendor UI — but 8 grids evenly at 2/4/8 across breakpoints and 10 does not. **My recommendation: keep 8, and call it "your eight best."** Say the word and it becomes 10.
2. **ETA honesty.** Vendor-declared bands are cheap and immediately useful, but vendors will over-promise. Are you willing to ship declared-only in phase 4 and add observed correction later, or do you want to hold ETA until it can be measured?
3. **Quick-actions rail content.** Hubtel's rail is bill-pay verbs because they are a payments company. Alkemart's equivalent has to be filters. Do you want it to be filters, or do you have real *services* (top-up, bill pay) planned that would make it a verb rail after all?
4. **Rating floor.** Show `★ 4.6 (1)` off a single review, or suppress ratings until N≥3? Suppression is more honest; display is denser. **Recommendation: show from 1, but only show the count in parentheses so a lone review reads as a lone review.**

---

## 6. Explicitly out of scope here

Checkout, payments, returns, the admin operational surfaces, and performance work. This plan touches discovery and trust only.

**Relationship to existing plans.** [vendor-store-manager.md](plans/vendor-store-manager.md) P3 is where `shop_featured (…, rank ≤ 8)` came from, and P1–P3 are substantially built (`store.tsx`, pause mode, contact/hours, featured endpoints). **W3 is an extension of that plan's P3, not a replacement** — it adds the buyer-accurate preview and ordering UI on top of the endpoints P3 delivered. W4's vendor-settings surface should land in the same tab. [trust-growth-backlog.md](plans/trust-growth-backlog.md) is orthogonal (admin trust, audit log) and needs no reconciliation.
