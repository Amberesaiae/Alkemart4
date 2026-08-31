# Alkemart Cloudflare Rebuild — Ghana Marketplace Design

| Field | Value |
|---|---|
| **Date** | 2026-08-31 |
| **Status** | Draft for review — approved in brainstorming dialogue |
| **Supersedes (runtime path)** | Medusa v2 + Mercur on Railway as long-term production engine |
| **Does not supersede** | Commercial spine money/MoMo ADRs in `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md`; Paystack Ghana runbook; Ghana locale package rules |
| **Audience** | Engineers implementing the Cloudflare-native Alkemart marketplace |
| **Related as-built** | `docs/architecture/2026-08-02-full-system-architecture-and-lifecycles.md`, `2026-08-02-canonical-data-flow.md` |
| **Trust / taxonomy / UX research** | `2026-08-31-taxonomy-ux-dataflow-trust-research.md` (binding amendments in §4.1, §6.1, §11) |

---

## 1. Problem and decision

Alkemart is a **Ghana-first multivendor marketplace**. The current production shape is:

- **API:** Medusa v2.17 + Mercur 2.2 on Railway (Bun/Node)
- **DB:** Neon Postgres
- **Cache/jobs:** Railway Redis + Medusa jobs/subscribers
- **Search:** Meilisearch
- **Storefront:** Vite/React PWA on Vercel
- **Vendor/Admin:** TanStack panels hosted via Mercur UI modules
- **Payments:** Paystack (MoMo + card) + COD
- **Notify:** Africa’s Talking SMS, Meta WhatsApp, Resend email

That stack delivered marketplace vocabulary quickly, but it carries framework gravity that fights Accra latency, Cloudflare-native ops, and long-term maintainability:

- Marketplace truth split across Medusa modules, Mercur entities, custom `/alkemart/*` routes, and **metadata-as-schema**
- Long-lived Node + mandatory Redis poorly mapped to edge Workers
- Stock-location / shipping-profile ceremony for a flat Ghana delivery fee
- Dual commission models; dispute-as-metadata scans
- Documented Accra→US Neon chatty-graph latency (catalog warm 3–7s class problems)
- Archive history already shows the cost of **dual write paths** (Express + Medusa)

### Decision

**Study Medusa and Mercur. Leave them behind as runtime.**

Rebuild a **lean, owned marketplace kernel** on Cloudflare:

- Workers (Hono) API
- Postgres via Hyperdrive as system of record
- R2, KV, Queues, Cron Triggers
- Durable Objects **only** for MoMo/checkout concurrency
- Pages for the three existing SPAs (UX kept, APIs rewired)

v1 bar: **Ghana core commerce slice** (browse/search, MoMo+card+COD, seller onboard/list/fulfill, admin approve/suspend, webhooks/payouts, SMS/WA). Not near-total feature parity on day one.

---

## 2. Goals and non-goals

### Goals

1. Cloudflare-primary hosting: Pages + Workers + R2 + KV + Queues + Cron (+ Hyperdrive to Postgres).
2. Own an agnostic, maintainable schema that is Ghana-correct in v1 and multi-market capable later (`market_code`, `currency_code`).
3. Preserve commercial invariants: charge-before-order, pesewas integers, webhook idempotency, seller isolation.
4. Keep buyer / vendor / admin UX; replace `@medusajs/js-sdk` with a typed OpenAPI client.
5. Lift `@alkemart/shared/ghana` as the single locale brain.
6. One production write path only — no Express/Medusa dual-home during cutover.

### Non-goals (v1)

- Running Medusa or Mercur on Cloudflare Containers as the long-term engine
- Multi-country live checkout beyond Ghana
- External courier rate engines / label printing
- Per-vendor partial cancel of multi-vendor orders
- Real-time chat infrastructure
- Full VAT/NHIL calculation engine beyond documented constants
- Stock Mercur admin/vendor UI modules
- Line-by-line port of `archive/*`
- D1 as system of record

---

## 3. System topology

```
 Buyers (Pages PWA)          Vendors (Pages)           Admins (Pages)
 apps/storefront             apps/vendor               apps/admin
        │                         │                         │
        └─────────────────────────┴─────────────────────────┘
                                  │ HTTPS OpenAPI
                                  ▼
                    ┌─────────────────────────────┐
                    │  Workers API (Hono)         │
                    │  /store /vendor /admin      │
                    │  /hooks/paystack            │
                    └──────┬──────┬──────┬────────┘
           Hyperdrive      │      │      │
                           ▼      │      │
                     Postgres SoR │      │
                     (Neon/etc.)  │      │
                                  ▼      ▼
                           KV cache   R2 media
                                  │
                    Queues / Cron / DO (MoMo only)
                                  │
                    Paystack · Africa’s Talking · Meta WA · Resend
```

| Concern | Choice | Rationale |
|---|---|---|
| SoR | **Postgres + Hyperdrive** | Money, inventory, payouts, multi-vendor joins |
| Edge API | **Workers + Hono** | Accra-near compute, simple TypeScript ops |
| MoMo concurrency | **Durable Object per payment intent** | Serialize pending → webhook → complete; DO alarm for TTL |
| Catalog cache | **KV + Cache API** + Hyperdrive query cache | Replace Redis catalog cache |
| DB bindings | **Two Hyperdrive bindings** | `HYPERDRIVE` (cacheable catalog SELECTs) + `HYPERDRIVE_PRIMARY` (auth, payments, read-after-write — cache disabled) |
| Async work | **Queues + Cron** | Notifications, image derivatives, search sync, orphan TTL sweep |
| Media | **R2** | S3-compatible; already preferred in docs |
| Search v1 | **Postgres FTS** (Meili optional later) | Fewer moving parts for Ghana slice |
| Frontends | **Pages** | Existing SPAs; fail-closed env |

**Latency note:** Hyperdrive reduces connection tax to Postgres; chatty ORM graphs must still die. Catalog list endpoints return denormalized/DTO projections, not deep entity graphs.

---

## 3.1 Multivendor spine (non-negotiable)

Alkemart is **not** a single-merchant shop with a vendor bolt-on. Every read/write path assumes **many sellers, one marketplace catalog**.

```
                    Product (canonical content + category)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Offer A          Offer B          Offer C
      (seller_1,         (seller_2,       (seller_3,
       price, stock)      price, stock)    price, stock)
```

| Rule | Meaning |
|---|---|
| **Product ≠ Offer** | Product = what it is (title, media, category, attributes). Offer = who sells it at what price/stock. |
| **ATC binds `offer_id`** | Never add “a product” to cart. Always a specific seller’s offer. |
| **PLP is product-centric** | One card per **product**: `fromPricePesewas`, `offerCount`, `bestOfferId` (cheapest sellable). |
| **PDP lists peer offers** | `GET /store/products/:id` returns product + **all sellable offers** (seller handle, price, stock, delivery fee). Buyer picks an offer. |
| **Seller shop** | `GET /store/sellers/:handle` lists that seller’s sellable offers only. |
| **Unique offer** | DB unique `(seller_id, product_id, variant_id)` — one price/stock row per seller per variant. |
| **Cart is multi-seller** | Cart lines may mix sellers; UI groups by seller; quote returns per-seller subtotals + fees. |
| **Order splits by seller** | On payment success: one **OrderGroup** + **N Orders** (one per seller) with line items retaining `seller_id` + `offer_id`. |
| **Fulfillment / payout per seller** | Ship/deliver and settlement never cross seller boundaries. |
| **Vendor isolation** | Every `/vendor/*` query is `WHERE seller_id = auth.seller_id`. Admin can cross sellers; store can read public offers only. |
| **Commission per seller** | `sellers.commission_bps` applied at payout line generation — not at ATC. |

**Forbidden single-merchant shapes:** product row that owns price/stock; cart line without `offer_id`; PDP “Buy” with no seller choice when `offerCount > 1`; admin/vendor sharing one unscoped product table API.

---

## 4. Domain model (Medusa/Mercur lessons → owned schema)

### Principles

1. Explicit tables for money and marketplace truth — no metadata-as-schema for payment status, commission, or disputes.
2. **Offer is the sellable unit** (Mercur). Product is catalog content; Offer binds seller + variant + price + stock.
3. Integer **pesewas** in DB and API; display formatting only in UI.
4. Seller-scoped writes by construction (`seller_id` on every vendor mutation path).
5. Ghana is v1 default market; schema stays market-agnostic.
6. **Multivendor spine (§3.1) beats convenience** — never collapse Offer into Product to “ship faster.”

### Core entities

| Entity | Lesson source | Notes |
|---|---|---|
| Market | Medusa Region (simplified) | `code=gh`, `currency=ghs` |
| User / AuthIdentity | Medusa Auth | email/password; actor links |
| Customer | Medusa Customer | buyer profile |
| Seller | Mercur Seller | `pending_approval \| open \| suspended \| terminated`; `commission_bps`; Ghana address; Paystack `recipient_code` |
| SellerMember | Mercur Member | seller ↔ user role |
| Category | Medusa Category + taxonomy research | tree max depth 3; handle + display name from DB only; optional Google/Shopify map ids |
| CategoryAttribute | Shopify SPT lesson | per-category filterable attributes (enum/number/text); requiredness for propose |
| Product | Medusa Product | `draft \| proposed \| published \| rejected`; **`primary_category_id` NOT NULL**; quality score as columns |
| ProductVariant | Medusa Variant | sku / options |
| Offer | Mercur Offer | seller + product/variant + `price_pesewas` + `on_hand`/`reserved`; **UNIQUE (seller_id, product_id, variant_id)**; never carries taxonomy |
| Cart / CartItem | Medusa Cart | items reference **offer_id** (+ denormalized `seller_id` for grouping) |
| PaymentIntent | Commercial spine | first-class MoMo/card/COD state machine (one intent can cover multi-seller cart total) |
| StockReservation | (new, best practice) | soft hold **per offer** while MoMo pending |
| OrderGroup | Mercur order group | buyer-facing parent for a multi-seller checkout |
| Order / OrderItem | Medusa + Mercur split | **one Order per seller** under OrderGroup; lines retain `seller_id` + `offer_id` |
| Fulfillment | Simplified | per-seller status; flat delivery fee from seller profile |
| Return / Dispute | Explicit tables | no JSONB flag scans |
| Payout / PayoutLine | Mercur Payout | commission from `commission_bps` only |
| Wishlist | Simple joins | customer ↔ product/offer |

### 4.1 Taxonomy & trust amendments (from research)

1. **Keep Ghana’s 12 root departments** from `ensure-ghana-categories.ts` (Food, Beverages, Fashion, Phones & Electronics, Home, Health & Beauty, Baby & Kids, Pet Care, Agriculture, Automotive, Services, Other).
2. **Add L2 only for Phones & Electronics, Fashion & Apparel, Food & Groceries** in v1. Other departments stay flat until volume justifies splits.
3. **Attributes, not deeper folders**, for brand/size/network/material. Seed attribute packs for Phones + Fashion in v1; others category-only until needed.
4. **Require `primary_category_id` on propose** — target a **leaf** (or flat root with no children). No soft flag that leaves catalog uncategorized while nav pretends otherwise. After publish, category change requires re-moderation (Jumia VendorHub pattern).
5. **SPA may map handle → icon/art only.** Forbidden: parallel name tables, title-regex classification, inventing tabs. Vendors pick from the **official** tree only in v1 (no private “My Categories” navigation fork).
6. **Pesewas-only in DB and API responses.** One shared `Price` component (`en-GH`). Ban major-unit money fields in the public contract.
7. **Catalog read model is multivendor:** `GET /store/catalog` returns **product cards** (`fromPricePesewas`, `offerCount`, `bestOfferId`). `GET /store/products/:id` returns peer offers. No dual-fetch rehydrate.
8. **Fail-closed honesty:** error UI ≠ empty UI; docs regenerated from code at cutover.
9. **Inventory states on Offer:** `on_hand`, `reserved`, `available = on_hand - reserved` (soft hold increments `reserved` per offer).

### Derived rules (domain services)

- **Sellable** = published product + seller `open` + active GHS offer + stock > 0 + readiness complete
- **Seller readiness (GH v1)** = profile + pack/delivery address (+ payout recipient before payouts)
- **Moderation** = propose → approve / reject / request-changes

### Deliberately dropped

- Stock locations / shipping profiles / service zones ceremony
- Sales-channel spaghetti for a single Ghana shop
- Dual commission systems
- API-process UI embedding

### Shared Ghana package

`packages/shared` (`@alkemart/shared/ghana`) remains canonical for regions, phone/MoMo detection, GHS helpers, address/GPS copy, tax constants. Workers and all frontends import it — never fork copies under app `lib/`.

---

## 5. Ghana money lifecycles

### Payment provider (binding)

**Paystack is the only payment and payout rail for Alkemart v1.** Do not introduce a generic “PaymentProvider” / Stripe-shaped abstraction, multi-PSP router, or invented gateway.

| Rail | Paystack API (canonical) |
|---|---|
| MoMo charge | `POST /charge` with `mobile_money` (MTN / Vodafone→`vod` / AirtelTigo→`atl`) |
| Card | `POST /transaction/initialize` + verify |
| Refunds | Paystack refund on the charge/transaction |
| Seller payouts | Transfer recipient (`mobile_money` / GHS) + Transfer API |
| Webhooks | `POST /hooks/paystack` — `x-paystack-signature` HMAC-SHA512 |

Port helpers from existing `paystack-client.ts` (pesewas conversion, MoMo slug map, signature verify, amount assert). COD stays an Alkemart-native method with **no** Paystack call until/unless explicitly charged later.

### Invariants

1. Charge-before-order (COD explicit exception).
2. Pesewas integers end-to-end (Paystack amounts are pesewas).
3. Webhooks are source of truth for async MoMo; client poll is UX only.
4. Idempotent confirm (unique Paystack reference + KV event dedup).
5. All-or-nothing cancel for multi-seller carts in v1.

### Methods

| Method | Flow |
|---|---|
| MoMo | PaymentIntent → **Paystack** charge → often pending → DO + webhook → verify → Order |
| Card | PaymentIntent → **Paystack** initialize → redirect → server verify → Order |
| COD | PaymentIntent `cod` → Order immediately (no Paystack) |

### MoMo status machine (`PaymentIntent.status`)

```
initiated → pending → succeeded → completed
                  ↘ failed
         → expired
succeeded → refunded
```

**Durable Object:** one DO per `payment_intent_id` serializes transitions and owns the 30-minute TTL alarm. Postgres is the ledger.

**Soft stock hold:** on MoMo `pending`, insert `StockReservation`; release on `failed`/`expired`; commit (decrement stock, clear reservation) on `completed`.

### Webhook path (`POST /hooks/paystack`)

1. Verify HMAC signature  
2. KV dedup by event id / reference  
3. DO / confirm service  
4. Paystack verify + amount match  
5. Single Postgres transaction: intent succeeded → create Order (+ seller-split lines)  
6. Enqueue SMS/WA/email + projections  

### Payouts

Eligible delivered lines − `commission_bps` → Paystack Transfer to seller MoMo `recipient_code`. Single commission field only.

### Notifications

Priority: SMS (Africa’s Talking) → WhatsApp templates → email (Resend). Queue consumers only; never block webhook response.

### Job map

| Legacy Medusa job | Cloudflare |
|---|---|
| `momo-payment-ttl` | DO alarm + Cron orphan sweep |
| image processing | Queue → transform → R2 |
| search reindex | Queue on catalog mutations |
| catalog Redis cache | KV / Cache API invalidation |

---

## 6. API surface and frontend rewire

### Namespaces (preserve mental model)

| Namespace | Actor | Auth |
|---|---|---|
| `/store/*` | Buyer | publishable key + customer session |
| `/vendor/*` | Seller member | seller-scoped JWT/session |
| `/admin/*` | Platform admin | admin JWT |
| `/hooks/*` | Paystack etc. | signature verification |

Custom product routes stay under clear domain paths (no Medusa SDK shapes required). Prefer `/store/catalog`, `/store/checkout`, etc., documented in OpenAPI.

### Contract

- **OpenAPI 3** as sole client source  
- Orval (or equivalent) → Zod + TanStack Query hooks  
- Fail-closed env validation on Workers and Vite apps  

### Route rule

Routes parse / validate / authorize only. Domain logic lives in `packages/domain` services (port of today’s “thin route, fat lib” rule).

### Frontends

| App | Path | Change |
|---|---|---|
| Storefront | `apps/storefront` | Drop `@medusajs/js-sdk`; wire OpenAPI client; generalize PWA cache hosts to API origin env; deploy Pages |
| Vendor | `apps/vendor` (from `ghana-vendor`) | Same client; stop bundling into API process |
| Admin | `apps/admin` | Same; deploy Pages independently |

Deep-links between shop ↔ seller ↔ admin remain. Never merge into one SPA (archive lesson).

### 6.1 Full-app UX amendments (Baymard + Jumia-shaped)

**Information architecture**

- Top-level nav = product departments (not a single buried “Shop” item), especially on mobile.
- Split **ICP** (parent category: subcategory tiles first, breadcrumbs, identifying imagery) from **PLP** (leaf: filterable offer grid + sort).
- Homepage must show catalog **breadth** (majority of departments visible) so shoppers infer scope.
- Mobile shell: Home · Categories · Search · Cart · Account (Jumia-like). Search is a first-class path.

**Commerce surfaces**

- PLP/home cards: show **from** price + “N sellers” when `offerCount > 1`; tap opens PDP, not silent ATC of a random seller.
- PDP: canonical product + **peer offers table** (seller, price, stock, delivery fee); ATC always binds chosen `offer_id`.
- Cart: group by seller; totals from a server **quote** endpoint (pesewas); multi-seller fees visible before pay.
- Checkout steps: Address → Delivery → Payment (MoMo / COD / Card) → Review; dedicated MoMo pending page (poll + SMS guidance).
- **Guest checkout** is the prominent path (Baymard); account creation optional after purchase. Mark required vs optional fields explicitly; no surprise fees at payment step.
- Strong “you-are-here”: breadcrumbs, highlighted nav, numbered checkout steps.
- One `Price` + one empty/error policy across storefront, vendor, admin.

**Vendor**

- Quick-list / propose requires primary category + that category’s required attributes.
- Same Product/Offer DTOs as admin moderation (no parallel shapes).

---

## 7. Target monorepo layout

```
Alkemart4/
  apps/
    api/                 # Hono Workers — sole write path
    storefront/          # Buyer PWA (Pages)
    vendor/              # Seller panel (Pages)
    admin/               # Admin panel (Pages)
  packages/
    shared/              # @alkemart/shared (Ghana + brand) — LIFT
    domain/              # pure TS: checkout, sellable, readiness, payouts
    db/                  # Drizzle schema + migrations
    api-spec/            # OpenAPI
    api-client/          # generated hooks
    ui/                  # shared UI — LIFT
  archive/               # existing frozen trees + later medusa/mercur archive
  docs/architecture/     # money ADRs remain binding
  e2e/                   # Playwright against Cloudflare preview/prod
```

Current `apps/backend` (Medusa+Mercur) freezes to `archive/` at cutover — reference only.

---

## 8. Phased delivery

| Phase | Outcome | Exit gate |
|---|---|---|
| **0 — Foundation** | Workers+Hono skeleton, Hyperdrive, Drizzle migrations, R2, KV, CI, OpenAPI stub, shared Ghana wired | `wrangler deploy` health + migrate |
| **1 — Catalog read** | Categories, products, offers, sellable projection, KV cache, storefront browse/PDP rewired | Accra browse p95 target agreed in plan |
| **2 — Identity** | Auth email/pass, buyer/vendor/admin sessions, seller register + admin approve/suspend | RBAC e2e green |
| **3 — Seller write** | Ghana onboarding, quick-list, moderation, R2 media pipeline | Vendor can list; admin can publish |
| **4 — Checkout money** | Cart, PaymentIntent, MoMo DO+webhook, card, COD, soft holds, order create | Paystack staging matrix green |
| **5 — Fulfillment + payouts** | Ship/deliver, returns/disputes tables, payout trigger | Settlement smoke |
| **6 — Cutover** | DNS/Pages, webhook endpoints, freeze Medusa writes, archive backend | Single write path; rollback plan tested |

**Cutover rule:** warm reads and migrate data, then **hard switch writes**. No dual production writers.

**Data migration:** map Medusa/Mercur entities → owned schema via ETL scripts; Ghana locale constants do not migrate (code). Media: copy or re-point to R2.

---

## 9. What to port vs discard

### Port / lift

- `packages/shared/src/ghana/**`
- Commercial spine invariants and Paystack Ghana behaviors
- Domain rules: seller readiness, product lifecycle, sellable, product quality, offer pricing
- Notification adapters + event matrix
- Storefront / vendor / admin UX contracts
- Architecture ADRs for money (binding)

### Discard

- Medusa + Mercur runtime and UI module hosting
- Stock-location / shipping-profile ceremony
- Dispute-as-metadata pattern
- Redis-as-boot-requirement
- Railway/Vercel as the long-term primary topology (may remain interim during phases 0–5)
- Archive Express/legacy trees as runtime

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Owning commerce correctness | Explicit PaymentIntent + reservations + transactional order create; e2e money suite before cutover |
| Workers CPU/time limits on image work | Queue + separate consumer; keep webhook handlers short |
| Postgres still distant from Accra | Hyperdrive + DTO/list projections + KV; consider AF/EU Postgres region when available |
| Scope creep to full parity | Hard v1 non-goals; phase gates |
| Dual-write temptation | Written cutover rule; archive Medusa at switch |
| Paystack webhook gaps | DO + Cron orphan sweep; poll status as UX only |

---

## 11. Success criteria (v1)

1. Buyer in Ghana can browse sellable catalog, checkout with MoMo (async) or COD, and receive SMS confirmation.
2. Seller can onboard, list, get approved, fulfill.
3. Admin can approve/suspend sellers and moderate products; trigger payouts.
4. All money paths use pesewas; webhooks idempotent; no double orders under concurrent webhook/poll.
5. Single Cloudflare-primary write path; Medusa not required for production traffic.
6. Frontends remain three separate apps with shared OpenAPI client and `@alkemart/shared`.
7. **Trust gates:** zero dual SoTs for money units, catalog reads, taxonomy labels, or commission; no cart-metadata payment ledger; no client title-regex categories; ICP/PLP nav live for departments with L2.
8. **Multivendor gates:** two sellers can list the same product as separate offers; PLP shows one card with `offerCount`; PDP lists peer offers; ATC uses `offer_id`; paid checkout creates per-seller orders under one OrderGroup; vendor APIs cannot read/write another seller’s offers.

---

## 12. Next step after spec approval

Invoke **writing-plans** to produce a phased implementation plan under `docs/superpowers/plans/` with tracer-bullet vertical slices aligned to Phases 0–6 above.

Do not scaffold the new `apps/api` Workers project until that plan is reviewed and approved.
