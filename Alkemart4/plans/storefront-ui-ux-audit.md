# Storefront UI/UX audit — clean surfaces, marketable course

**Status:** audit + roadmap. Nothing here is implemented except where marked ✅.
**Method:** local stack live (API `:8787`, storefront `:5175`) at 1280px against the real
catalogue, plus a read of every storefront route and the shared primitives.
**References:** Hubtel consumer app captures (home shelves, store cards, PDP), MOWAFER
deals page, and [plans/ux-overhaul-marketplace-surfaces.md](ux-overhaul-marketplace-surfaces.md)
(W1–W7), which this document does not replace — it re-orders and extends it.
**Companion:** [docs/architecture/homepage-merchandising.md](../docs/architecture/homepage-merchandising.md)
for how beats are configured.

---

## 1. The one-sentence thesis

We have a **strong design system under a weak merchandising surface**: the tokens,
type roles, contrast ramp, focus rings and skeleton discipline are already better
than most Ghanaian commerce sites, but the pages do not yet *prove* the three
things a multi-vendor buyer needs before tapping — **who sells it, whether anyone
trusted them, and when it arrives**. Almost every fix below is about making the
existing data visible, in a consistent rhythm, and stopping the last three
inconsistencies a buyer can see.

Two rules to hold the whole thing together:

1. **One anatomy per object.** A product card is one component with one set of
   facts in one order. A shop card is one component. If a surface needs different
   emphasis, it changes *size*, never the fact set or their order.
2. **Every beat earns its place.** A shelf that repeats the shelf above it, or
   that a young catalogue cannot fill, is worse than no shelf. Beats de-duplicate
   against each other and hide honestly when they cannot be distinct.

---

## 2. What is already working — do not re-litigate this

| Area | Evidence | Why it matters |
|---|---|---|
| Semantic token system | `styles/index.css`, `design/brand.ts` — charcoal ink, premium white, gold as accent only | No per-page hex drift; dark footer and gold CTAs stay in one register |
| Contrast is *computed*, not eyeballed | `tone-ramp.test.ts` re-derives every tone pair from CSS and fails under WCAG AA 4.5:1 | A future palette edit cannot silently ship unreadable chips |
| Gold never becomes a surface | `no-cream.test.ts` greps for `bg-primary/N` and raw amber surfaces | This is the reason the site reads premium-white instead of cream |
| Type roles with a 14px floor | `.type-sm` … `.type-section`, `.eyebrow` | Small type is one system, not a drift of 10/11/12px one-offs |
| Accessibility baseline | `:focus-visible` ring, `.touch-target`, reduced-motion block that kills every animation, `aria-label`s on scroll controls | Cheap wins already banked |
| Honest states | `MerchEmpty`, `useShelfSource` returning nothing rather than an unrelated slice, no invented `% off` | Trust is the differentiator; fabricated claims would destroy it |
| Merchandising engine | 10 section types, draft/publish/schedule, per-section windows, Studio + storefront share primitives | We can change the page without a deploy — use it |
| Card trust facts ✅ (today) | `product-card.tsx` renders title · seller · price · rating; ratings are now joined onto catalogue cards in `/store/catalog` | The single highest-leverage fact set in the plan |

---

## 3. Findings, by severity

Severity is "how much does this cost us in trust or conversion", not effort.

### P0 — visible defects that read as "unfinished"

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **Numbers render without a label.** PDP shows a bare `38` under "About this item" — a review count with no noun, no stars, no context. | PDP of "Leather Sandals" at 1280px | Every figure gets its unit in the same component that renders it. Audit for bare counts across PDP/store/PLP. |
| 2 | **Price row wraps, so rows misalign.** `From GHS 1,850.00` + `★ 4.9 (38)` pushes the count onto a second line on some cards and not others. | Home "Featured For You" and "Top Rated Items" | `whitespace-nowrap` on the rating, `min-w-0 truncate` on the price, and drop the `From` prefix below the price line when `offerCount > 1`. |
| 3 | **Rating count is present on some cards, absent on others** (`★ 4.9` vs `★ 4.9 (38)`). | Same shelves | One formatter (`lib/product-rating.ts`) decides the string; no card composes it inline. |
| 4 | **The same six products fill two shelves.** Featured and Top Rated show the same photos in a different order. | Home at 1280px with the real catalogue | Beats de-duplicate: each shelf excludes products already rendered above it; if a beat cannot fill, it collapses rather than repeating. |
| 5 | **A shop with no banner renders as a blank white card** with a 24px storefront glyph. | `/shops`, "Kumasi Tech" | Designed fallback: department tint + monogram + category label, same language as the product card's no-photo tile. |
| 6 | **Asset provenance is visible on the artwork.** `stablediffusionweb` watermark legible on the electronics photo, in the mosaic *and* in product tiles. | Home mosaic + deals grid | Art QA gate before upload; re-crop or replace. A watermark on a product photo is a credibility leak on every surface that shows it. |
| 7 | **Mosaic rotation ghosts.** The fashion tile caught mid-crossfade shows two images blended at ~50%. | Home mosaic, top-right tile | Crossfade only on hover, or swap with no overlap; never leave two art layers composited at rest. |
| 8 | **Breadcrumb says "Browse".** `Home / Browse / Hurry Ventures / Leather Sandals`. | PDP | Use the real category name from the same taxonomy the breadcrumb's parent uses. |

### P1 — the trust gap (the differentiator we are not using)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 9 | **No delivery expectation anywhere.** Not on cards, not on store cards, not in the buy box. The only delivery text is a seller-set fee policy paragraph. | `product-card.tsx`, `StoreRail.tsx`, PDP buy box | Seller-declared band (`25–40 min`) as W4 stage 1. Always a band, never a single number. |
| 10 | **Store cards sell nothing.** `/shops` cards carry name + area + `NEW SHOP`. No rating, no ETA, no open/closed, no product preview, no distance. | `/shops` at 1280px | W2. The DTO work is already known: rating/sales/availability/featured strip. This is the strongest single visual upgrade available. |
| 11 | **The PDP hero is mostly empty and the description is absent.** Title, seller, price, then ~200px of dead space in the left column; the price is printed twice on the same screen. | PDP at 1280px | One price (rail owns it, or the column owns it — not both); reviews/rating next to the title; description promoted into the empty space; a sticky buy bar under 768px. |
| 12 | **No compare-at price, so "Deals" is a claim without a receipt.** Deals of the day shows ordinary prices with an eyebrow that says "Today only". | Home, deals grid | Either the catalogue gains `compareAt`, or retitle the beat to something true ("Fresh prices this week") until it does. Merchant-owned copy must not imply a discount we cannot show. |
| 13 | **PEER offers are invisible on the shelves.** `offerCount > 1` is rendered as a `From` prefix, but the actual multi-seller comparison lives only on the PDP. | `product-card.tsx` | Keep `From` (it is a real advantage), and make the count tappable: "3 sellers" → PDP offers panel. |

### P2 — discovery and rhythm

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 14 | **Three ways to browse categories, none authoritative.** Header links (`Home · Stores · Purchases`), the `CategoryReel` rail, and the PLP facet panel. The rail also sits *inside* the merchandising course, between two shelves. | Home (rail between "Featured" and "Deals"), PLP | One browse affordance per context: rail under the header for verb-style entry, mosaic for taxonomy, facets for narrowing. Move the rail above the first shelf (it is currently injected after it). |
| 15 | **The header contradicts the design spine.** `SPINE.md` rule 2 says chrome is logo · search · account · cart with no Home/Help links; the built header renders `Home · Stores · Purchases` *and* a Search button beside the search field. | `AppHeader.tsx` vs `SPINE.md` | Pick one and update the doc. Recommendation: keep `Home · Stores · Purchases` (Stores must be a peer for a multi-vendor market), drop the redundant Search button, and fix the spine. |
| 16 | **PLP sort control shouts.** Four equal-width buttons, the active one a solid gold block, sitting above the fold and pushing results down. | PLP at 1280px | Compact sort control (slim segmented pills or one dropdown above `lg`), gold reserved for the primary action. |
| 17 | **PLP hero wastes a third of the first screen.** A tall card with a small image and vertically centred title. | PLP | Halve its height; the image is a category mood shot, not a hero. |
| 18 | **Spacing is now right on home, but not specified elsewhere.** Home beats are `48px` apart (`sm:space-y-12`); PLP/store/PDP panels use their own rhythms. | Home vs PLP/PDP | Write the rhythm into the spine: page section `48`, intra-section block `24`, grid gap `12/16`, and use it everywhere. |
| 19 | **Mobile has never been verified in this pass.** Every finding above was captured at 1280px. | — | Screenshot 390px for home, PLP, PDP, cart before touching anything else. Ghana traffic is mobile-first; treat desktop as the secondary case. |

### P3 — system hygiene

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 20 | **Storefront typecheck is red** — three `Property 'context' does not exist` errors in `shops.$slug.tsx`. | `bun run typecheck` in `apps/storefront` | Either add the prop to `ProductCardProps` or drop it at the call sites. A red typecheck hides the next real error. |
| 21 | **`SPINE.md` has drifted.** It names `design/tokens.ts` (no such file — tokens live in `styles/index.css`) and a "fixed Mowafer order: mosaic → last offers → delivery → advertise" that no longer matches the course. | `SPINE.md` vs `shared/homepage.ts` | Regenerate the spine from the code it describes; a spine that lies is worse than none. |
| 22 | **Unused imports** across home components (e.g. the whole `StoreCard*` family in `StoreRail.tsx`). | `StoreRail.tsx` | Enable `noUnusedLocals` for the storefront so drift is a compile error, not a review note. |

---

## 4. The marketable approach

Marketing is not a banner at the top; it is the *order of proof* down the page.
The course we now ship is:

```
mosaic          → art-led entry, our taste, our categories
Featured For You→ our curation, mixed sellers, mixed departments
Deals of the day→ real prices, department tabs, one inline campaign tile
[campaigns]     → seasonal strips from Studio, never first
Top rated items → buyers' scores, earned
Top rated shops → the vendors behind them, verified
```

What each beat must prove, in the buyer's words:

| Beat | Buyer question | Must show |
|---|---|---|
| Mosaic | "Do they sell my kind of thing?" | 4 departments, product photography, no text burned into art |
| Featured | "Is this a real shop with real stock?" | Price · seller · rating on every card, ≥ 3 departments represented |
| Deals | "Is anything a good price today?" | One price per card, honest framing, tabs that narrow instantly |
| Proof (items) | "Has anyone else bought this?" | Ratings with counts, most-rated first, **no overlap with Featured** |
| Proof (shops) | "Who am I actually buying from?" | Rating, ETA, open/closed, a strip of their own top items |

Campaign mechanics that stay honest with today's catalogue:

- The inline campaign tile in the deals grid is the right pattern (merchandising
  *inside* the merchandise). Keep it — but style it as an ink tile, not a full
  gold block: one gold element per screen is the budget, and on the home page the
  CTA already owns it.
- No `% off`, no strikethrough, no "was" price until `compareAt` exists.
- "Top rated" means published reviews only. Zero reviews renders nothing, never `0 (0)`.

---

## 5. Roadmap

Sequenced so each phase is independently shippable and visibly better.

### Phase 1 — Make the page tell the truth (days, not weeks)

1. Card anatomy fixes: no wrapping, one rating formatter, no bare numbers, `From` prefix demoted when long.
2. De-duplicate products across beats; a beat that cannot fill collapses.
3. Move `CategoryReel` above the first shelf; stop injecting it mid-course.
4. Designed fallbacks: shop art, category art, product art (one language).
5. Asset QA: re-crop or replace watermarked art; fix mosaic ghosting.
6. Green typecheck + unused-import sweep.

**Acceptance:** home at 1280px and 390px shows no repeated product, no wrapped price row, no bare number, no blank card, no watermark; `bun run typecheck` clean.

### Phase 2 — Store cards that sell (W2/W3, the multi-vendor identity)

7. `/store/sellers` returns rating, sales, availability, declared delivery band, featured strip.
8. `/shops` rebuild: search, sort, filter, real cards, empty states.
9. Vendor "shop window" panel + one-click "fill with my best sellers".

**Acceptance:** every shop card answers "trusted? when? who?" without a click; a shop with no reviews shows no rating rather than a zero.

### Phase 3 — Discovery and conversion

10. Delivery band everywhere (W4 stage 1): cards, store cards, buy box, cart seller groups.
11. PDP rebuild: one price, rating beside the title, description in the empty column, sticky mobile buy bar, "3 sellers" → offers.
12. Search: suggest-as-you-type, recent queries, category scoping, no-results recovery.
13. PLP: compact sort, shorter hero, facets that survive a refresh (URL state).

**Acceptance:** a returning buyer can go search → PDP → cart without a dead end, and every price on screen has a seller and a rating next to it.

### Phase 4 — Campaign system and polish

14. Studio gains the new fields (`promoTile`, `showAllLink`, tabs variant) as first-class controls, not JSON.
15. Campaign calendar: scheduled beats with countdowns already supported — wire them to real events.
16. Motion/performance pass: LCP image priority, CLS on every art frame, hover states under reduced-motion.

**Acceptance:** marketing can run a weekend campaign without a deploy, and the page keeps its rhythm.

---

## 6. Measurement (instrument before Phase 2)

Per beat: impression → tap-through; per shelf: scroll depth entered; PDP: add-to-cart rate split by whether rating and ETA were rendered; `/shops`: card → store page rate split by whether featured items existed; search: zero-result rate and recovery rate. `trackHomepageViewed` already exists — extend it rather than adding a new pipeline.

---

## 7. Open decisions

1. **`compareAt` price** — do we add it (deals become real), or retitle the beat until then? *Recommendation: retitle now, schema in Phase 4.*
2. **Header chrome** — resolve `SPINE.md` rule 2 vs the built `Home · Stores · Purchases`. *Recommendation: keep the links, drop the Search button, rewrite the rule.*
3. **Deal tab tabs vs rail** — tabs for the hub, rail for flash sales. Confirm the Studio should expose both.
4. **Shelf size** — the plan says "top seven items"; the schema caps limits at `4 | 8 | 12`, which grid evenly. *Recommendation: keep 8 and call it "top eight"; a 7-item grid is ragged at every breakpoint.*
