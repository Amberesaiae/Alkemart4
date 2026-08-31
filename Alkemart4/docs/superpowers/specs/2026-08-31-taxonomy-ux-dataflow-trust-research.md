# Research: Taxonomy, UX, Backend-First Data Flows & Trust Repair

| Field | Value |
|---|---|
| **Date** | 2026-08-31 |
| **Status** | Research addendum to Cloudflare rebuild design |
| **Companion** | `2026-08-31-cloudflare-ghana-marketplace-design.md` |
| **Method** | Web primary sources (Baymard, Shopify Taxonomy, Cloudflare docs, marketplace architecture literature) + blunt codebase trust audit |

---

## 0. Verdict on “~80% not trustworthy”

**That instinct is correct.** The repo *documents* a single commerce spine (`no-hardcodes`, pesewas, API-as-SoT) and then ships **overlapping sources of truth**, **metadata-as-entities**, **stale ADRs**, and **client heuristics that invent classification**. Distrust is a rational read of the system, not vibes.

Top trust breaks (from live code + docs):

1. Money unit dualism (Medusa major GHS vs Paystack/shared pesewas vs mixed UI formatters)
2. Cart `metadata` as MoMo payment ledger (no durable PaymentIntent table)
3. Catalog dual-read (`/store/alkemart/catalog` ⊕ Medusa `product.list` ⊕ `/store/offers` enrich)
4. Taxonomy not one SoT (DB seed names ≠ SPA `CATEGORY_META` labels ≠ regex offer tabs; category optional on propose)
5. Commission duality (`metadata.commission_bps` vs Mercur commission-rates)
6. Metadata-as-domain (disputes, quality, payment, media)
7. Three frontends × three API dialects × two `Price` formatters; duplicate `@alkemart/shared`
8. Ops ghosts (shipping/stock-location ceremony for flat delivery fees)
9. Docs disagree with code (webhook “missing”, Express-era audits still in the reading path)
10. Dual-worktree / archive residue in operational scripts

This research defines **how industry practice says to fix** taxonomy, UX, and backend-first data flows in the Cloudflare rebuild.

---

## 1. Taxonomy & categorisation — industry practice

### What high-trust sources agree on

| Principle | Source consensus | Implication for Alkemart |
|---|---|---|
| **Shopper language, not org chart** | Baymard, AtroPIM, Voyado | Labels must match how Ghanaians search (“Phones”, not “ICT Solutions”) |
| **Shallow tree + rich attributes** | Baymard, Extralt, Lasso: ~2–4 levels; push size/brand/color into **filters/attributes**, not deeper folders | Keep ~8–12 top departments; add L2 only when purchase intent differs |
| **One primary category per product** | Pumice, WISEPIM | Product has one `primary_category_id`; optional secondary for merchandising only |
| **Separate taxonomy from attributes** | Shopify Standard Product Taxonomy, Extralt | Category = navigation home; attributes = filterable facts bound to category |
| **Map internal taxonomy → channel taxonomies** | Google Product Taxonomy, Shopify SPT | Internal Ghana tree is SoT; map to Google for ads later — never invert |
| **Governance** | AtroPIM | Named owner + change process; no silent SPA renames |
| **Avoid over-categorisation** | Baymard (~75% get it wrong) | Don’t create empty leaf nodes; don’t regex-bucket from titles |

Shopify’s open **Standard Product Taxonomy** (categories + attributes + values, versioned releases through 2026) is the best *reference vocabulary* for attribute design. **Do not dump Shopify’s entire tree into Alkemart.** Use it to shape **attribute schemas per department**, while keeping a **Ghana shopper navigation tree**.

### Current Alkemart taxonomy reality

Canonical seed (`ensure-ghana-categories.ts`) already has a sensible Ghana department set:

Food & Groceries, Beverages, Fashion & Apparel, Phones & Electronics, Home & Living, Health & Beauty, Baby & Kids, Pet Care, Agriculture, Automotive, Services, Other

Problems:

- Storefront `CATEGORY_META` **renames** seed names (`Health & Beauty` → “Personal Care”, `Phones & Electronics` → “Electronics”)
- Offer tabs / filters use a **third** id space and **title regex** when handles missing
- `ALKEMART_REQUIRE_CATEGORY_ON_PROPOSE` defaults **off** → catalog can be uncategorized while nav pretends taxonomy is real
- Flat roots only — no L2, no category-bound attributes → filters cannot be trustworthy

### Recommended taxonomy model (rebuild)

```
Category (tree, max depth 3)
  id, handle, name_en, name_display?, parent_id, rank, is_nav, is_leaf
  google_product_category_id?   -- optional mapping for ads
  shopify_taxonomy_gid?         -- optional mapping for attribute packs

CategoryAttribute
  category_id, key, label, type (enum|number|text|boolean), required, filterable, rank
  allowed_values[] for enums

Product
  primary_category_id  NOT NULL
  attribute_values jsonb or ProductAttributeValue rows

Offer stays sellable (price/stock/seller) — never carries taxonomy
```

**Ghana v1 tree proposal**

- Keep the 12 roots (they match Jumia-style African marketplace departments; Beverages and Pet Care as first-class is correct per seed comments).
- Add **L2 only for high-intent splits**, e.g.:
  - `phones-electronics` → Phones, Accessories, Computing, TVs & Audio
  - `fashion-apparel` → Men, Women, Kids, Shoes, Bags
  - `food-groceries` → Staples, Cooking Oil, Snacks, Fresh (if enabled)
- Everything else (brand, size, network band, organic) = **attributes**, not folders.
- **Require** `primary_category_id` on propose (flip the flag permanently in the new schema).
- **Single label SoT:** `Category.name` from API. SPA may have icon/art maps keyed by **handle only** — never a parallel name table. Delete title-regex classification.

### Navigation UX (Baymard + Jumia)

Baymard findings that must drive storefront IA:

1. **Product categories as top-level nav** (not buried under one “Shop” hover) — especially on mobile.
2. Distinguish **Intermediary Category Page (ICP)** vs **PLP**:
   - ICP (e.g. Phones & Electronics): subcategory tiles first, above promos; identifying imagery; breadcrumbs.
   - PLP (e.g. Phones): filterable offer grid, sort, pagination.
3. 76% of sites bury subcategory nav under promos — Alkemart mosaic/rail must not repeat that mistake on mobile.
4. Aim ~10–15 children max per node; group when larger.
5. Homepage should show **breadth** (~40%+ of departments visible) so Accra shoppers infer catalog scope (Baymard homepage research).

Jumia / African marketplace patterns:

- Mobile-first bottom nav: Home · Categories · Search · Cart · Account
- Step checkout; MoMo + COD as first-class trust rails
- Low-bandwidth: small assets, NetworkFirst API, explicit pending MoMo screen
- SMS confirmation after order (already in Alkemart spine — keep)

---

## 2. Backend-first principles (canonical data flows)

### Industry pattern for marketplaces

Literature and platform practice converge on:

1. **Canonical Product** (content, identity, category, attributes, media)  
2. **Offer / Listing** (seller, price, stock, SLA) attached to Product  
3. **Single inventory ledger** with reservation → commit → release  
4. **Payment intent / ledger** as first-class aggregate (not cart JSON)  
5. **Order** created only after payment success (or explicit COD)  
6. **API contract first** (OpenAPI) — frontends are projections, never SoT  
7. **Domain services enforce invariants**; routes stay thin  

This matches Medusa/Mercur *concepts* (Product vs Offer, charge-before-order) without their runtime.

### Canonical write flows (rebuild)

```
Seller lists
  → validate category + required attributes
  → Product (proposed) + Offer (price_pesewas, stock)
  → quality score
  → admin publish
  → emit catalog.changed → KV invalidate + search index

Buyer ATC
  → CartItem(offer_id, qty) only
  → server prices from Offer (never client amount)

Checkout MoMo
  → PaymentIntent row (pesewas, status, refs, expires_at)
  → StockReservation
  → Paystack charge
  → webhook/DO → verify → Order + commit stock
  → Queue notify SMS/WA

Payout
  → PayoutLine from delivered OrderItems − commission_bps
  → Paystack transfer to recipient_code
```

### Hard backend-first rules (binding)

| Rule | Detail |
|---|---|
| **One money unit** | Pesewas `bigint` everywhere in DB + API. Display formatting only in `@alkemart/shared` / one `Price` component. Ban major-unit fields in API responses. |
| **One catalog read model** | `GET /store/catalog` returns sellable cards. No SPA dual-fetch rehydrate. Peer offers = explicit `/store/products/:id/offers`. |
| **One taxonomy SoT** | Categories table + API. SPA icons by handle. No rename table. No title regex. |
| **One payment ledger** | `payment_intents` table. Cart may reference `payment_intent_id` only. |
| **One commission field** | `sellers.commission_bps`. Drop dual Mercur commission entity for v1. |
| **Fail closed** | Missing env / missing offer / Paystack decline → error UI, never empty success. |
| **OpenAPI-first** | Spec before handlers; generated client only in all three apps. |
| **Events after commit** | Notifications/search/cache via Queue; webhook returns 200 fast after durable write. |

### Cloudflare storage mapping (official guidance)

Per Cloudflare storage options docs:

| Concern | Product |
|---|---|
| Commerce SoR (orders, money, offers) | **Postgres + Hyperdrive** |
| Catalog/session hot reads | **KV** |
| Media | **R2** |
| MoMo serialization / TTL | **Durable Objects** |
| Async notify / images / reindex | **Queues** |
| Not SoR | D1 (optional later read model only) |

---

## 3. Frontend rewiring — kill inconsistencies

### Contract

- One OpenAPI client package for storefront, vendor, admin
- One `Price` component (pesewas in → GHS out, `en-GH` locale)
- One error vs empty policy: **errors are ErrorAlert; empty is EmptyState; never Error disguised as Empty**
- Auth: shared session helper patterns per actor; no three inventively different token stores without docs

### Storefront IA improvements (full app experience)

| Surface | Improvement |
|---|---|
| **Home** | Department breadth first (tiles/rail); featured sellable only from API; no mosaic that lies about empty categories |
| **Categories** | Top-level nav = departments; ICP for parents with children; PLP for leaves |
| **Search** | Primary path (BrightEdge: majority of sessions start with search); filters from category attributes |
| **PDP** | Product content + **peer offers** list (price/seller/delivery); ATC bound to selected `offer_id` |
| **Cart** | Group by seller; show delivery fee honesty; pesewas totals from server quote endpoint |
| **Checkout** | Steps: Address → Delivery → Payment (MoMo/COD/Card) → Review; MoMo pending = dedicated status page with poll + SMS tip |
| **Account/Orders** | Status timeline; return/dispute entry points that hit real tables |
| **PWA** | Cache API origin from env (not hard-coded Railway host) |

### Vendor / admin consistency

- Same OpenAPI types for Product/Offer/Order
- Vendor quick-list **requires** category + required attributes for that category
- Admin moderation queue uses same product DTO as vendor (no parallel shapes)
- Shared empty/loading/skeleton patterns from `@workspace/ui`

### Delete / forbid in rebuild

- `CATEGORY_META` name overrides (icons/art only)
- Title-regex category inventing
- `formatMoney` that assumes major units
- Dual catalog feature flags that change buyer truth
- Cart metadata payment fields
- Demo/fossil fields on live types
- Duplicate `packages/shared` trees

---

## 4. How this amends the Cloudflare design

The design in `2026-08-31-cloudflare-ghana-marketplace-design.md` already chose Workers + Postgres + DO-for-MoMo + keep UX. This research **tightens** it:

| Area | Amendment |
|---|---|
| Domain | Add `Category` tree + `CategoryAttribute` + required `primary_category_id` |
| Money | Explicit ban on major-unit API fields; single formatter |
| Catalog | Single read DTO; kill dual-fetch |
| Taxonomy governance | Seed in migrations; admin can edit; SPA never renames |
| UX | ICP vs PLP; Baymard nav rules; Jumia-like mobile IA |
| Trust gate | Phase exit criteria include “zero dual SoTs for money/catalog/taxonomy/commission” |
| Docs | Living architecture index must be regenerated from code; archive Express audits clearly marked historical |

---

## 5. Sources (web)

### Taxonomy / categorisation
- Shopify Standard Product Taxonomy explorer: https://shopify.github.io/product-taxonomy/
- Baymard — Ecommerce category pages: https://baymard.com/learn/ecommerce-category-page
- Baymard — IA principles & category nav benchmarks (homepage/category mediocre-to-poor ~67% mobile 2025)
- Industry guides (2025–2026): Hypotenuse, Extralt, AtroPIM, Voyado, Lasso, Pumice — consensus on shallow trees, attributes vs folders, shopper language, channel mapping

### Marketplace data architecture
- Canonical Product + multi-Offer pattern (multi-vendor catalog scale literature)
- Single inventory ledger / reservation patterns
- API-first commerce domain surfaces (cart, pricing quote, inventory, payments as separate contracts)

### Cloudflare
- Storage options matrix: https://developers.cloudflare.com/workers/platform/storage-options/
- Hyperdrive Postgres: https://developers.cloudflare.com/hyperdrive/

### Ghana / Africa UX
- Jumia mobile-first IA, MoMo + COD trust, step checkout, SMS confirmation (case studies / market patterns)

### Local audit
- Codebase trust audit 2026-08-31 (categories seed, catalog-nav, offer-filter, ghana-checkout, money formatters, dual clients)

---

## 6. Immediate design decisions to lock

1. **Pesewas-only API** — yes/no (recommended: yes)
2. **Require primary category on propose** — yes (recommended)
3. **L2 categories in v1 for Phones, Fashion, Food only** — recommended
4. **Attribute packs per category** (v1: phones & fashion only; others category-only) — recommended to avoid boiling the ocean
5. **ICP + PLP split in storefront** — recommended
6. **Single generated API client for all three apps** — yes

These should be folded into the design spec before writing the implementation plan.

---

## 7. Deep-research cross-check (workflow, 2026-08-31)

A bounded multi-agent research pass (Shopify, Medusa, Mercur, Stripe, Baymard, NN/g, Cloudflare, Jumia VendorHub, AWS/GCP retail guidance) **confirms** the locked design. Additional refinements worth capturing:

| Finding | Source | Design impact |
|---|---|---|
| One **official** marketplace category tree; vendors map internal “My Categories” onto it | Mercur category mapping [S4] | Optional later: seller private tags ≠ navigation taxonomy. v1: sellers pick from official tree only. |
| Jumia GH/CI: **leaf category required before create**; category effectively fixed after create; **category-specific mandatory attributes** on templates | Jumia VendorHub [S5] | Propose must target a **leaf** (or flat root if no children). Changing category after publish requires admin/re-moderate. |
| Payment provider metadata is reconciliation only — **own cart + payment intent** | Stripe PaymentIntents [S6] | Reinforces first-class `PaymentIntent` table; cart metadata never owns MoMo state. |
| Merchandising ≠ stock; named qty states (`available`, `committed`/`reserved`, …) | Shopify inventory [S8] | Model `on_hand`, `reserved`, `available = on_hand - reserved` on Offer (or inventory row). |
| Anything with its own lifecycle = module/table; metadata = one plain extra property max | Medusa/Mercur module isolation [S9–S11] | Same as our “no metadata-as-schema” rule. |
| Categories as **first-level** nav (esp. mobile); ICP leads with subcategory tiles; ~10–15 per section | Baymard [S12–S13] | Already in §6.1 of design. |
| Checkout: **guest checkout prominent**, numbered steps, no-surprise costs, mark required/optional fields | Baymard Checkout UX 2025 [S14]; NN/g [S17] | Storefront checkout: guest path first-class; MoMo phone + address required fields explicit. |
| Hyperdrive: **cache catalog SELECTs**; **separate cache-disabled binding** for auth, sessions, billing, read-after-write | Cloudflare Hyperdrive query caching [S18–S19] | Two Hyperdrive bindings in `wrangler`: `HYPERDRIVE` (cached reads) + `HYPERDRIVE_PRIMARY` (uncached money/auth). |
| Edge accelerates Postgres — does not replace transactional SoR | CF storage options [S20]; AWS/GCP retail [S21–S23] | Already decided. |

**Coverage gaps noted by research (do not overfit):** no single primary doc is a full “Africa marketplace blueprint”; seller-admin IA is under-researched by Baymard/NN/g; Shopify has no Mercur-style Offer entity — we keep Mercur’s Product↔Offer split as the marketplace lesson.

Full workflow report: session `workflows/.../scratch/report.md` (sources S1–S23).
