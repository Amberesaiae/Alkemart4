# Plan: Data/stats, self-building filters, search, SEO & Ghana adaptation (non-overkill)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Status** | **Plan — adopt existing architectures**, do not invent a platform |
| **Principle** | Medusa/Mercur stay the commerce system of record; Alkemart adds **thin adapters** for Ghana + discovery + measurement |
| **Tone** | Robust enough for multi-vendor Ghana, small enough for one product team |

Related:

- E2E procedures: `2026-07-17-complete-e2e-architecture-procedures.md`
- No hardcodes: `2026-07-16-no-hardcodes-no-magic.md`
- Paystack/MoMo: `2026-07-15-paystack-ghana-integration.md`
- Commercial spine: `2026-07-13-alkemart-architecture-and-commercial-spine.md`

---

## 1. What you are asking for (restated)

| Need | Meaning |
|------|---------|
| **Data & statistics** | Know what sells, what buyers do, what sellers list — for ops and product |
| **Self-building filters** | Facets (category, price, seller, attributes) that appear from **real catalog data**, not hand-coded filter lists |
| **SEO & search** | People find products via Google + on-site search that feels modern |
| **Existing architecture** | Prefer known stacks (Medusa + search engine + event analytics + standard SEO patterns) |
| **Ghana adaptation** | MoMo, digital address, phone-first, multi-vendor reality — **adapters**, not a Medusa fork |
| **Non-overkill** | Phased; no Elasticsearch cluster + data lake on day one |

---

## 2. Architecture to adopt (industry standard, three layers)

Do **not** build a custom search engine, custom analytics warehouse, or custom PIM first.

```text
┌─────────────────────────────────────────────────────────────────┐
│  STOREFRONT (apps/storefront)                                    │
│  · SEO pages + JSON-LD                                           │
│  · Search UI + facet UI (consumes search API)                    │
│  · Product/commerce events (thin client SDK)                     │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│  SEARCH INDEX (adopt)     │   │  PRODUCT ANALYTICS (adopt)        │
│  Meilisearch (preferred)  │   │  PostHog Cloud (or Plausible CE)  │
│  or Typesense             │   │  Events only — not SoR for money  │
│  Facets + full-text       │   └─────────────────────────────────┘
└─────────────▲─────────────┘
              │ subscribers / jobs
┌─────────────┴───────────────────────────────────────────────────┐
│  SYSTEM OF RECORD (already chosen)                               │
│  Medusa + Mercur API  ·  Neon Postgres                            │
│  Products · offers · orders · customers · sellers                │
│  Ghana: ghana-checkout, Paystack module, address fields          │
└──────────────────────────────────────────────────────────────────┘
```

| Concern | Adopt | Avoid (overkill now) |
|---------|-------|----------------------|
| Commerce | Medusa + Mercur (current) | Rewrite catalog in custom DB |
| On-site search + facets | **Meilisearch** (official Medusa integration path) | Elasticsearch/OpenSearch ops |
| Hosted alternative | Algolia only if budget & zero ops | Building ranking from scratch |
| Product analytics | **PostHog** (events, funnels, ecommerce event spec) | Self-host PostHog at scale day 1 |
| Web traffic only | **Plausible CE** (privacy, light) | GA4-only dependency |
| SEO | Framework + standard ecommerce schema | Headless CMS just for meta tags |
| Ghana payments | Paystack adapter (existing direction) | Multiple PSPs |
| Ghana address | Optional GhanaPostGPS + phone + landmark fields | Mandatory GPS API for every guest |
| Filters “self-building” | Facets from **index attributes** of live products | Static filter config in SPA |

Why Meilisearch: Medusa documents a full integration guide (module + product subscribers + reindex + storefront InstantSearch). That is the architecture to copy, adapted to our Vite storefront instead of Next starter.

---

## 3. Self-building filters (faceted search) — how it works

### Industry pattern

Facets are **not** a hard-coded list of brands in React. They are:

1. **Attributes on each product document** in a search index (category, seller, price, region, condition, …).  
2. At query time, the engine returns **facet counts for the current result set**.  
3. The UI **renders only facets that have counts > 0** (and optionally hides low-count noise).  

Logic: **OR within a facet group, AND across groups** (e.g. color Blue OR Red, AND brand Nike). Counts update as selections change.

That is “self-building”: when sellers add a new category or attribute that is indexed, filters appear without shipping a SPA release of filter names.

### Alkemart index document (minimum viable)

Index **published** products only (plus offer/price snapshot for the storefront region):

| Field | Source | Facetable? |
|-------|--------|------------|
| `id`, `title`, `description`, `handle` | Product | search |
| `thumbnail` | Product | no |
| `category_ids` / `category_handles` | Categories | yes |
| `seller_id`, `seller_handle`, `seller_name` | Mercur seller link | yes |
| `min_price`, `max_price`, `currency_code` | Offer / calculated price for GH region | yes (price ranges) |
| `has_offer` | Boolean — can ATC | yes |
| `tags` | Product tags | yes if used |
| optional Ghana: `city`, `region` | Seller or product metadata | yes for local discovery |

**Rule:** only index fields that already exist on API entities or explicit seller metadata — never invent facet values in the SPA.

### Storefront UX (Baymard-style, non-overkill)

- Desktop: left/top facet list with **counts**.  
- Mobile: full-screen filter sheet.  
- Collapse long facets; expand primary ones (category, price, seller).  
- Clear all / clear chip per facet.  
- URL reflects filters (`?q=&category=&seller=&price=`) for shareable SEO-ish browse states (careful with infinite combinations — see SEO).

### Implementation path (adopt Medusa Meilisearch guide)

1. Run Meilisearch (Docker local / Meilisearch Cloud).  
2. Backend module: index product documents (extend guide fields with **seller + price**).  
3. Subscribers: `product.created|updated|deleted` (+ offer/seller link events when available).  
4. Admin-only reindex job (button or CLI).  
5. Storefront: replace naive `listStoreProducts({ q })` with Meilisearch InstantSearch **or** proxy `POST /store/search` that calls Meilisearch server-side (hides master key). Prefer **search-only API key** in browser if InstantSearch; else backend proxy only.

**Phase 0 (now):** keep Medusa `product.list` + `q` for lab.  
**Phase 1:** Meilisearch index + search box.  
**Phase 2:** facets UI driven by facet distribution.  
**Phase 3:** synonyms, ranking rules, seller boost.

---

## 4. Data & statistics collection (non-overkill)

Split **two kinds of data** so you do not overbuild.

### A) Commerce statistics (truth for money & ops)

**Source of record:** Neon / Medusa / Mercur (orders, offers, sellers).

| Metric | How (simple) |
|--------|----------------|
| GMV, order count, AOV | SQL / Admin reports on `order` |
| By seller | Order line → seller linkage |
| By category | Product → category |
| COD vs MoMo mix | `ghana-checkout` / payment metadata |
| Funnel drop (checkout fail) | API error rates + order incomplete carts (later) |

**Adopt:** Postgres queries + Admin UI (Mercur admin analytics when available) + optional Metabase/Grafana on Neon read replica **later**.  
**Do not:** copy all orders into a second warehouse day one.

### B) Product / behaviour analytics (how people use the site)

**Adopt PostHog Cloud** (or Plausible for pageviews only):

| Event (examples) | When |
|------------------|------|
| `product_viewed` | PDP open |
| `product_added` | ATC |
| `checkout_started` | Enter checkout |
| `order_completed` | After COD/MoMo success |
| `search_performed` | Query submitted |
| `filter_applied` | Facet change |
| `seller_store_viewed` | `/store/$slug` |

Align names with [PostHog ecommerce event spec](https://posthog.com/docs/data/event-spec/ecommerce-events) where possible so dashboards are free.

**Privacy (Ghana + global):**

- Prefer consent banner when using non-essential cookies.  
- Do not put MoMo phone / full address into analytics props.  
- Plausible CE if you only need “visits + top pages” without product funnels.

### C) Seller-facing stats

- **v1:** Seller Hub built-in order/product views (Mercur).  
- **v2:** PostHog or SQL-backed “your shop views” only if sellers demand it.  
- Vendor isolation: never expose other sellers’ stats.

### D) Event pipeline shape (keep boring)

```text
Storefront capture → PostHog (SaaS)
API domain events  → optional same PostHog server-side (order_completed)
Postgres           → money / inventory truth
Meilisearch        → discovery only
```

No Kafka, no custom CDP until volume forces it.

---

## 5. SEO architecture (robust, still lean)

SPA reality: Vite React is **client-rendered**. For serious SEO without overkill:

### Recommended path

| Phase | Approach |
|-------|----------|
| **Now** | Correct titles, meta description, canonical, Open Graph on critical routes via router + `document.title` (already partial); sitemap of **static** routes; robots.txt |
| **Soon** | **Prerender or SSR shell** for PDP + category + seller store (Cloudflare Workers / prerender service / migrate PDP to lightweight SSR later) |
| **Content** | JSON-LD `Product`, `Organization`, `BreadcrumbList` from API data only |
| **Facet SEO** | Index **category** and **seller** pages; **noindex** arbitrary multi-facet combos (`?color=x&brand=y&…`) to avoid crawl explosion |

### Self-building SEO metadata

- Title: `{product.title} · alkemart`  
- Description: first ~155 chars of API description or seller name + category  
- Never invent ratings/reviews/schema fields you do not have  

### Ghana SEO notes

- Local intent: city / region pages only when you have real inventory density (else thin content).  
- Brand: always **alkemart**, not engine names.

---

## 6. Ghana adaptation of Medusa — adapters, not overkill

Medusa is global. Ghana needs **policy + fields + payments**, not a fork.

### 6.1 What stays standard Medusa/Mercur

- Product, cart, order, customer, region, sales channel  
- Seller hub + admin panels  
- Multi-vendor offers / commissions (Mercur)

### 6.2 Thin Ghana adapters (Alkemart-owned)

| Adapter | Responsibility | Status / plan |
|---------|----------------|---------------|
| **Region policy** | Default GH + GHS; countries from region API | Configure Admin; SPA reads countries |
| **Checkout** | `POST /store/ghana-checkout` COD (+ MoMo later) | COD lab; MoMo spine planned |
| **Paystack module** | Server-side charge / webhook | Keys optional; Mode B without MoMo |
| **Address model** | Phone required; optional `postal_code` as GhanaPostGPS; free-text landmark / directions | Align with Ghana delivery practice |
| **Money** | Display GHS; server pesewas for Paystack | Keep integer pesewas on charge path |
| **Seller onboarding** | Register in Seller Hub; admin approve | Documented E2E |
| **Search locale** | Meilisearch: English + common GH product terms synonyms later | Phase 3 |

### 6.3 Ghana delivery UX (non-overkill)

Inspired by local ecommerce practice (digital address adoption uneven):

1. **Phone** required at checkout (rider contact).  
2. **Address line + city + region** from form/region countries.  
3. **GhanaPostGPS** as **optional** field (same as optional postal).  
4. **Landmark / directions** optional free text (metadata or address field).  
5. Map pin: **later**, not blocking COD lab.

Do **not** require GPS API for every order day one.

### 6.4 What not to do

| Overkill | Why |
|----------|-----|
| Custom Ghana order table parallel to Medusa order | Dual source of truth |
| Hardcode MTN/Vodafone as only catalog | Config / payment metadata |
| Rebuild Seller Hub in SPA “like Jiji Sell” | Use Hub + `/sell` entry branding |
| Full Elasticsearch + data lake | Meilisearch + Postgres first |

---

## 7. Phased roadmap (procedures)

### Phase 0 — Solidify SoR (current / short)

- [x] Greenfield storefront + COD path  
- [x] Seller Hub + Admin branded alkemart  
- [ ] Stable Ghana region + SC + publishable key in env  
- [ ] At least one live seller with offers on storefront  

### Phase 1 — Measurement (1–2 weeks effort)

1. [x] PostHog client + env `VITE_PUBLIC_POSTHOG_KEY` / `VITE_PUBLIC_POSTHOG_HOST` (no-op when unset).  
2. [x] Instrument storefront: `$pageview`, `product_viewed`, `product_added`, `checkout_started`, `order_completed`, `search_performed`, `seller_store_viewed`.  
3. [ ] Admin: simple SQL or dashboard for order counts / GMV (even a Metabase on Neon later).  
4. [x] Event dictionary — see appendix §12.

### Phase 2 — Search + self-building filters (2–4 weeks)

1. [x] Meilisearch deploy path: `docker-compose.search.yml` (or binary/Cloud).  
2. [x] Thin search lib + subscribers in `apps/backend/packages/api` (`src/lib/search/*`).  
3. [x] Index document includes seller + min_price + categories (when graph provides them).  
4. [x] Store proxy `GET|POST /store/search` (falls back to product.list when disabled).  
5. [x] Facet UI on `/search` (self-building from facetDistribution); browse facets can follow.  
6. [x] Admin **Search sync**: `POST /admin/search/reindex` + `medusa exec ./src/scripts/reindex-search.ts`.

### Phase 3 — SEO hardening

1. [x] JSON-LD on PDP + seller store + Organization home (`lib/seo.ts`, `PageSeo`).  
2. [x] Static `public/sitemap.xml` + `robots.txt`; **dynamic** `GET /store/sitemap` (published handles).  
3. [ ] Prerender critical routes or SSR migration for PDP/category only.  
4. [x] Facet URL policy: `noindex` when multi-facet and for `?q=` search results.

### Phase 4 — Ghana depth (aligned with money spine)

1. MoMo charge-before-commit + webhooks (existing Paystack plan).  
2. Landmark + GhanaPost optional polish.  
3. Seller shipping options per city/region when catalog density needs it.  
4. Synonyms / ranking for local product names (Meilisearch settings).

---

## 8. Decision summary (what we adopt)

| Decision | Choice |
|----------|--------|
| System of record | Medusa + Mercur + Neon (already) |
| Search + self-building facets | **Meilisearch** + product sync workflows (Medusa official pattern) |
| Product analytics | **PostHog Cloud** ecommerce events (Plausible optional for traffic) |
| SEO | SPA hygiene now → prerender/SSR for PDP/category later + JSON-LD |
| Ghana | Adapters: ghana-checkout, Paystack, address fields — **no Medusa fork** |
| Filters source | Index attributes of **live** products/offers |
| Branding | alkemart only in UI |

---

## 9. Explicit non-goals (this plan)

- Building a Jiji clone with chat-only checkout as the primary model (unless product pivots).  
- Custom ML recommendations engine.  
- Multi-region multi-currency complexity before GH is solid.  
- Duplicating seller analytics SPA in the buyer app.

---

## 10. Next implementation ticket (when you say go)

**Ticket A — Analytics skeleton**  
PostHog provider + 5 events on storefront; env-gated; no PII.

**Ticket B — Meilisearch module**  
Copy Medusa guide into `packages/api`; index published products with seller + min_price; reindex CLI/admin.

**Ticket C — Facet PLP**  
Storefront search page facets from Meilisearch distribution; URL state; empty honest UI.

---

## 11. Appendix — existing architectures referenced

| Architecture | Role |
|--------------|------|
| Medusa Module + Workflow + Subscriber | Index sync lifecycle |
| Meilisearch InstantSearch / Instant Meilisearch | Storefront search UI |
| Faceted navigation (retail best practice) | Self-building filters UX |
| PostHog ecommerce event spec | Stats / funnels |
| GhanaPostGPS + landmark checkout patterns | Local delivery fields |
| Alkemart clean-slate E2E handbook | Who logs where |

---

## 12. Appendix — storefront event dictionary (Phase 1)

| Event | When | Properties (no PII) |
|-------|------|---------------------|
| `$pageview` | Route pathname changes | `path` |
| `product_viewed` | PDP product loaded | `product_id`, `product_name`, `price`, `currency`, `seller_id` |
| `product_added` | ATC success | `product_id`, `offer_id`, `quantity`, `price`, `currency` |
| `checkout_started` | Checkout page with cart items | `item_count`, `cart_total`, `currency` |
| `order_completed` | COD place success | `order_id`, `payment_method`, `item_count`, `total`, `currency` |
| `search_performed` | Search results returned | `query`, `result_count` |
| `seller_store_viewed` | Seller store loaded | `seller_handle`, `seller_id` |

**Gating:** `apps/storefront/src/lib/analytics.ts` — no capture without `VITE_PUBLIC_POSTHOG_KEY`.  
**Never send:** email, phone, address, MoMo numbers, passwords, tokens.

---

**Document owner:** architecture  
**Update when:** search engine choice changes, analytics vendor changes, or Ghana payment mode leaves Mode B.