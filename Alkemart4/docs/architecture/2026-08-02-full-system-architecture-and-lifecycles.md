# Alkemart — Full System Architecture, Data Flow, Lifecycles & Codebase Integrity

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living document — as-built |
| **Scope** | Whole-system architecture: topology, data flow, every core lifecycle, Mercur integration, and the rules that keep the codebase coherent |
| **Audience** | Anyone (human or agent) working on Alkemart4 without re-discovering the monorepo |
| **Companion docs** | `2026-08-02-canonical-data-flow.md`, `2026-07-13-alkemart-architecture-and-commercial-spine.md` (money ADRs — still binding), `2026-07-16-clean-slate-backend.md` |

---

## 1. System Overview

Alkemart is a **Ghana-first multivendor marketplace** built on **Medusa v2** with **Mercur** (`@mercurjs/core`) providing the marketplace layer (sellers, members, vendor API scope, payouts). One backend, three frontends, one shared contract layer.

```
                        ┌────────────────────────────────────────────┐
                        │                 BUYERS                     │
                        │   apps/storefront (PWA, port 5175, "/")    │
                        └───────────────────┬────────────────────────┘
                                            │ @medusajs/js-sdk (store scope)
┌───────────────────────┐                   ▼                    ┌──────────────────────────┐
│       VENDORS         │      ┌────────────────────────────┐    │          ADMINS          │
│ apps/backend/apps/    │────▶ │        BACKEND API         │ ◀──│ apps/backend/apps/admin  │
│ ghana-vendor          │      │ apps/backend/packages/api  │    │ (port 3001, /dashboard/) │
│ (port 3002, /seller/) │      │  Medusa v2 + @mercurjs/core│    └──────────────────────────┘
└───────────────────────┘      │        (Bun runtime)       │
   fetch → /vendor/*           └─────┬──────┬──────┬────────┘        fetch → /admin/*
                                     │      │      │
                     ┌───────────────┘      │      └───────────────┐
                     ▼                      ▼                      ▼
              ┌────────────┐        ┌──────────────┐       ┌───────────────┐
              │  Neon PG   │        │   Paystack   │       │ Tigris/B2 S3  │
              │ (database) │        │ (card, MoMo, │       │ (media files) │
              └────────────┘        │  transfers)  │       └───────────────┘
                                    └──────┬───────┘
                                           │ webhooks (signed, deduped)
                                           ▼
                                 /hooks/paystack (route.ts)

 Side channels: AfricasTalking SMS (lib/sms.ts) · Meta WhatsApp (lib/whatsapp.ts)
                Email (lib/email.ts) · Redis cache/dedup (lib/redis-client.ts)
                Search index (lib/search/, subscribers/search-*) · Sentry
```

**Production topology (remote-first):** code is verified locally (typecheck + production build only), pushed to GitHub `origin/main`; **Railway** deploys the API, **Vercel** deploys the frontends, **Neon** hosts Postgres, **Tigris/B2** hosts media. There is no local live-testing loop — the deploy gate is `tsc --noEmit` + `vite build`/`bun run build` passing.

---

## 2. Monorepo Layout

```
Alkemart4/
├── apps/
│   ├── storefront/                  # Buyer PWA — React 19, Vite, TanStack Router/Query,
│   │                                #   @medusajs/js-sdk, vite-plugin-pwa, PostHog, Sentry
│   └── backend/                     # Backend workspace (own turbo.json, railway.toml)
│       ├── packages/
│       │   ├── api/                 # THE backend — Medusa v2 + Mercur (see §3)
│       │   └── ui/                  # backend-panel-local UI pieces
│       └── apps/
│           ├── admin/               # Admin dashboard (TanStack Router, port 3001)
│           └── ghana-vendor/        # Vendor dashboard (TanStack Router, port 3002)
├── packages/
│   ├── shared/                      # @alkemart/shared — Ghana domain constants (§7.1)
│   └── ui/                          # @workspace/ui — shared component library
├── e2e/                             # Playwright suites (checkout, refund, RBAC, isolation…)
├── k6/                              # load tests
├── scripts/                         # Neon connect, backend sync/migrate, smoke runners
├── docs/architecture/               # ADRs + this document
└── archive/                         # legacy trees — REFERENCE ONLY, never a write path
```

**Workspace wiring:** Bun workspaces with `workspace:*` protocol. `bun install` must run from the workspace root that owns the lockfile (`apps/backend` for the backend tree) — per-app installs break `@alkemart/shared` resolution.

**Rule:** `archive/` is dead code. Nothing imports from it; nothing new goes into it except retired trees.

---

## 3. Backend Architecture (`apps/backend/packages/api`)

### 3.1 Module composition (`medusa-config.ts`)

| Module | Source | Role |
|---|---|---|
| Auth | `@medusajs/medusa/auth` + `auth-emailpass` | email/password auth for all actor types |
| File | `@medusajs/medusa/file` + `file-s3` (Tigris/B2) / `file-local` (dev) | media storage |
| Payment | `@medusajs/medusa/payment` + **`./src/modules/paystack`** | Paystack card + MoMo provider |
| Payout | **`@mercurjs/core/modules/payout`** + **`./src/modules/paystack-payout`** | seller settlement via Paystack transfers |
| Admin UI / Vendor UI | `@mercurjs/core/modules/admin-ui`, `vendor-ui` | Mercur actor scoping (admin vs seller member) |
| Wishlist | `./modules/wishlist` (+ `src/links/`) | custom buyer wishlist with module links |

### 3.2 API surface (`src/api/`) — four namespaces, one convention

| Namespace | Actor | Auth scope | Examples |
|---|---|---|---|
| `/store/*` | Buyer | publishable key / customer JWT | `ghana-checkout`, `alkemart/catalog`, `search`, `wishlist`, `sitemap`, `featured-products` |
| `/vendor/*` | Seller member | Mercur vendor scope — **every query seller-scoped** | `alkemart/products`, `orders`, `returns`, `stats`, `onboarding/ghana-setup`, `quick-list`, `me` |
| `/admin/*` | Platform admin | admin JWT | `sellers/[id]/{approve,suspend,unsuspend,terminate,commission}`, `returns/[id]`, `payouts`, `disputes`, `commission-rates`, `moderation`, `search/reindex` |
| `/hooks/*` | External systems | signature verification, no session | `paystack` webhook |

Custom Alkemart routes live under an **`alkemart/` sub-segment** of each namespace to stay visually separate from stock Medusa/Mercur routes. Cross-cutting policy (rate limiting, auth guards) lives in `src/api/middlewares`.

### 3.3 Async machinery

- **Subscribers** (`src/subscribers/`) — event-driven side effects, all designed to **never throw into the event bus**:
  - `order-lifecycle-notify` — `order.placed → buyer+vendor SMS/WA`, `fulfillment_shipped/delivered → buyer SMS`, `order.canceled → buyer SMS`
  - `seller-lifecycle-notify`, `product-lifecycle-notify`, `return-lifecycle-notify` — same pattern per entity
  - `search-{product,seller,offer}-sync`, `search-product-delete` — keep the search index consistent
  - `catalog-cache-invalidate`, `seller-readiness-invalidate` — cache busting
  - `product-media-pending`, `seller-media-pending` — mark media for the processing jobs
- **Jobs** (`src/jobs/`) — scheduled work:
  - `momo-payment-ttl` — every 5 min, expires MoMo payments stuck in `initiated/pending/charged` past 30 min so carts/sessions are released
  - `process-product-images`, `process-seller-images` — media pipeline (resize/webp)
  - `recompute-sellable-search` — keeps "sellable" flags and search coherent
- **Lib** (`src/lib/`) — the domain kernel. Highlights: `ghana-checkout.ts` (entire checkout state machine), `paystack-client.ts`, `operating-markets.ts` (country canon + phone normalization), `offer-pricing.ts`, `seller-readiness.ts`, `commerce-stats.ts`, `rate-limiter.ts`, `audit-log.ts`, `sms.ts` / `whatsapp.ts` / `email.ts`, `search/`.

**Rule:** routes are thin — parse/validate/authorize, then call `lib/` functions or module services. Business logic never lives in a `route.ts`.

---

## 4. Data Flow

### 4.1 Read path (catalog/browse)

```
storefront → GET /store/alkemart/catalog … → catalog-cache (Redis) → Medusa query graph → Neon
                                     miss ↳ recompute + cache; invalidated by subscribers
search: storefront → /store/search → search index (kept in sync by search-* subscribers)
```

### 4.2 Write path (canonical shape for every mutation)

```
frontend hook (TanStack Query mutation)
  → lib/api.ts fetch → /vendor|/admin|/store route
    → middleware (auth, rate limit, seller scope)
      → route.ts (validate) → lib/ or module service (business logic)
        → Medusa modules → Neon (transactional)
        → event bus → subscribers (notify / index / invalidate)  [best-effort, never blocking]
  ← JSON ← toast + query invalidation/refetch in the app
```

### 4.3 Money data flow — the invariants

1. **All money is integer pesewas** end-to-end. Frontends convert for display only (`formatGHS`, `pesewasToMajor` from `@alkemart/shared/ghana`).
2. **Charge-before-order**: no order exists until payment is authorized (or COD explicitly chosen).
3. **Webhooks are the source of truth for async MoMo** — the sync response only starts the flow (see §5.4).
4. **Commission is bps in `seller.metadata.commission_bps`** (1000 = 10%); displayed as % everywhere; applied at payout computation.

---

## 5. Core Lifecycles

### 5.1 Seller lifecycle

Two overlapping state machines: Mercur's **status** (`pending_approval | open | suspended | terminated`) and Alkemart's derived **phase** (`setup_incomplete | pending_approval | active | suspended | rejected | terminated`). Fields: `status`, `status_reason`, `approved_at`, `rejected_at`.

```
register (Mercur seller + member) — status "open", phase "setup_incomplete"
   → onboarding: POST /vendor/alkemart/onboarding/ghana-setup
       (lib/ghana-seller-setup.ts — profile, region, GhanaPost GPS address, MoMo payout
        details → Paystack recipient_code, optional delivery_fee_ghs in seller.metadata)
       vendor polls /vendor/alkemart/onboarding/status for readiness
   → admin review: POST /admin/sellers/[id]/approve      → status "open" / phase active
   → operational states:
        suspend    POST /admin/sellers/[id]/suspend      → "suspended" (hidden from catalog)
        unsuspend  POST /admin/sellers/[id]/unsuspend    → active
        terminate  POST /admin/sellers/[id]/terminate    → terminal
   → commission:  POST /admin/sellers/[id]/commission    → metadata.commission_bps
```

Side effects: `seller-lifecycle-notify` (SMS/WA to seller), `search-seller-sync`, `seller-readiness-invalidate`. "Readiness" (`lib/seller-readiness.ts`) gates whether a seller's products are publicly sellable.

### 5.2 Product & offer lifecycle

Model: `Seller ↔ Product` via Mercur link module; the **Offer** is the sellable record (`seller_id`, `variant_id`, `product_id`, `sku`, `prices` → PriceSet, `inventory_items` → stock). Product statuses: `draft | proposed | published | rejected`.

```
vendor creates product (POST /vendor/alkemart/products, or quick-list → Product in
   "proposed" status, linked to seller, createOffersWorkflow attaches prices + stock)
   → quality pipeline (lib/product-quality.ts) + moderation (admin/alkemart/moderation)
   → media: upload → media-pending subscriber → process-product-images job → S3 webp variants
   → offers/pricing (lib/offer-pricing.ts): price per offer; vendor edits price, stock read-only (task #14 open)
   → sellable computation (lib/product-sellable.ts + recompute job):
        product is sellable iff approved + seller ready/active + priced + in stock
   → search-product-sync / search-offer-sync keep the index current
```

### 5.3 Order lifecycle

```
cart (Medusa CART module)
  → POST /store/ghana-checkout  (lib/ghana-checkout.ts — runGhanaCheckout dispatches:)
       COD:   runCodCheckout   — system payment provider, order created, pay-on-delivery
       Card:  runCardCheckout  — Paystack card charge → order on success
       MoMo:  runMomoCheckout  — Paystack MoMo charge → PENDING buyer USSD approval (§5.4)
  → order.placed → SMS/WA to buyer + each vendor
  → per-vendor fulfillment (vendor dashboard): not_fulfilled → fulfilled → shipped → delivered
       each transition → buyer SMS
  → cancellation:
       vendor: POST /vendor/alkemart/orders/[id]/cancel — soft cancel-REQUEST flag
               (only while not_fulfilled); admin decides
       admin:  hard cancel via /admin/orders/[id] — order.canceled → buyer SMS
```

Multi-vendor splitting: cart completion (`completeCartWorkflow` inside `lib/ghana-checkout.ts`) produces a Mercur **OrderGroup** with per-seller `Order` records via `order_seller` links. Fulfillment states are standard Medusa: `not_fulfilled → partially_fulfilled → fulfilled → shipped (→ delivered)`, with `canceled` terminal; vendors mutate via `/vendor/alkemart/orders/[id]/fulfillments`. Each seller sees and fulfils only their own slice — enforced server-side by vendor scoping, tested by `e2e/tests/multi-seller-isolation.spec.ts`.

### 5.4 Payment lifecycle (MoMo — the critical one)

```
initiated → pending (buyer must approve USSD prompt) → charged → captured (order paid)
     │                                                    ▲
     │            Paystack webhook /hooks/paystack ───────┘
     │              - signature verified
     │              - event-ID deduped (Redis SETEX, in-memory fallback)
     │              - confirmMomoByPaystackReference() completes cart → order
     ├─ storefront polls GET /store/ghana-checkout/status meanwhile
     └─ abandoned → momo-payment-ttl job (5 min cadence) → "expired" after 30 min TTL
```

⚠️ **Open (task #5):** full async confirmation must be exercised against live Paystack before launch; the machinery exists but is not battle-verified. Until then, treat MoMo as the #1 production risk.

### 5.5 Return / refund / dispute lifecycle

Medusa return states: `requested | received | partially_received | canceled`. Alkemart enriches `return.metadata` with `payment_id` / `payment_status` so refund paths can locate the original charge.

```
buyer requests return
  → vendor (returns.tsx): approve, or decline WITH typed reason (required)
  → admin (/admin/returns/[id]): approve | reject | refund  (refund = Paystack refund path)
  → escalation to dispute = SAME return entity with metadata.is_disputed = true
      (no separate dispute table — deliberate; see Why below)
  → admin /admin/disputes/[id]: resolve favor_buyer | favor_seller | partial
      → metadata.{resolution, resolution_note, resolved_at}
  → return-lifecycle-notify → SMS/WA
```

**Why metadata, not a new entity:** disputes are a *view* over returns with extra state; a separate entity would duplicate the return's money linkage and require sync. Revisit only if disputes acquire independent lifecycle needs (e.g. evidence uploads, arbitration threads).

⚠️ **Open (task #9):** vendor/admin are not yet notified at the moment a return is requested.

### 5.6 Payout lifecycle

```
order delivered/complete
  → payout computation: order total minus commission (metadata.commission_bps)
  → TODAY: manual — admin POST /admin/payouts {seller, amount, note}
  → Mercur payout module (Payout + PayoutAccount entities) → paystack-payout provider
      → Paystack transfer (recipient_code stored on the payout account from MoMo onboarding;
        trigger validates the seller has a valid Paystack recipient first)
  → GET /admin/payouts lists all; /admin/payouts/[id] detail
```

Mercur also ships a `Commission` entity (`@mercurjs/types`); Alkemart currently drives commission from `metadata.commission_bps` + `/admin/commission-rates` — converging these is part of the auto-payout work (task #10).

⚠️ **Open (task #10):** automatic trigger on order completion. The provider chain is real; only the automation is missing.

---

## 6. Mercur: What It Provides vs What Alkemart Adds

| Concern | Mercur (`@mercurjs/core`, `/types`, `/cli`) | Alkemart custom |
|---|---|---|
| Seller/member model | ✔ entities, vendor auth scope, `/vendor` API surface | Ghana onboarding (`ghana-seller-setup`), readiness gating, approval/suspension routes, commission bps |
| Multi-vendor orders | ✔ per-seller order splitting | vendor cancel-request flag, Ghana notifications |
| Payouts | ✔ payout module + payout_account | `paystack-payout` provider (GH MoMo transfers), admin trigger routes |
| Admin/Vendor UI scope | ✔ `admin-ui` / `vendor-ui` modules | Entire actual UIs are custom (TanStack apps) — Mercur's stock UIs are **not** used |
| Payments | ✖ | `paystack` payment provider, `ghana-checkout` state machine, webhook handler, MoMo TTL |
| Catalog UX | ✖ | search index + sync, catalog cache, featured products, wishlist, sitemap, SEO prerender |

**Upgrade discipline:** Mercur is a dependency, not a fork. Never patch inside `node_modules/@mercurjs`; extend via modules, routes, and metadata. Anything that *must* diverge gets an ADR in `docs/architecture/` first.

---

## 7. Codebase Integrity — Backend-First Principles

The backend is the **single source of truth**. Frontends render state; they never invent it.

1. **No facade code.** Every UI action calls a real endpoint that does real work. If the backend capability doesn't exist yet, the UI element doesn't ship (disabled with intent ≠ mocked success).
2. **Fail loudly.** No silent fallbacks. Errors propagate to the route boundary, return honest HTTP codes, and surface as toasts. Subscribers are the one exception (best-effort, logged), because notifications must never break commerce.
3. **Server-side authority for every rule.** Seller scoping, state transitions (who may cancel, when a return may be refunded), money math — all enforced in the API. Frontend checks are UX sugar only. `e2e` RBAC/isolation suites are the regression net.
4. **Route thinness.** `route.ts` = parse → validate → authorize → delegate to `lib/` or a module service. If a route grows business logic, extract it.
5. **One canonical home per concept.** Ghana constants → `@alkemart/shared/ghana` (regions, phone, currency, tax, payment). Country/phone normalization → `operating-markets.ts`. Frontends re-export/wrap (e.g. vendor `src/lib/ghana.ts`) — they never re-declare. Client-side helpers that mirror backend logic (phone normalization) must state which backend function they mirror and follow it.
6. **Metadata conventions over schema sprawl** — but documented. Current sanctioned keys: `seller.metadata.{commission_bps, delivery_fee_ghs}`, `return.metadata.{is_disputed, dispute_reason, dispute_opened_at, resolution, resolution_note, resolved_at}`, order cancel-request flag. Adding a metadata key = add it to this table in the same PR.
7. **Money discipline.** Integer pesewas everywhere; bps for rates; conversion at the display edge only.
8. **Migrations forward-only** through Medusa/Mercur tooling against Neon (`scripts/backend-migrate.ts`). Never hand-edit production schema.

---

## 8. Frontend Best Practices (as practiced here)

All three apps share one architecture — **keep it that way**:

1. **Stack uniformity:** React 19 + Vite + TanStack Router (file-based routes) + TanStack Query + Tailwind v4 + `@workspace/ui`. No second state library, no second router pattern.
2. **Three-layer data access:**
   - `src/lib/api.ts` (or `medusa.ts` in storefront) — the *only* place that knows URLs and fetch semantics, organized by domain namespace (`adminSellers`, `adminReturns`, `orders`, …)
   - `src/hooks/` / `lib/hooks.ts` — TanStack Query wrappers owning cache keys, invalidation, and success/error toasts (sonner, mounted once in `routes/__root.tsx`)
   - `src/routes/` — components consume hooks; **no raw fetch in components, ever**
3. **Mutations follow one shape:** optimistic-free by default → await → toast → invalidate/refetch. Destructive actions (terminate seller, refund, cancel order) always confirm via modal with the consequence stated.
4. **Base paths & ports are contracts:** storefront `/` :5175, admin `/dashboard/` :3001, vendor `/seller/` :3002. Vite `base`, dev-server port, workflow config, and reverse-proxy mapping must move in lockstep (this broke once — port 7002 drift).
5. **Type honesty at boundaries:** API response types declared next to the client (`AdminReturnDetail`, `AdminDispute`…). `unknown` metadata is narrowed (`String(...)`, ternaries) — never `any`. Both dashboards must pass `tsc --noEmit`; storefront has `typecheck` + vitest. **Open (task #8):** generate shared request/response types from the backend instead of hand-declaring.
6. **Ghana-first UX defaults:** SMS-grade copy, MoMo-prefix validation with provider auto-detect, GhanaPost GPS addresses, GHS formatting from shared package, low-bandwidth awareness (task #15: bundle splitting).
7. **PWA (storefront):** `vite-plugin-pwa` + workbox present; full offline story is task #6.

---

## 9. Verification & Deployment Gates

| Gate | Command | Applies to |
|---|---|---|
| Types | `bunx tsc --noEmit` | all apps + api |
| Production build | `bun run build` (admin runs `tsc -b && vite build`) | all frontends |
| Unit | `bun test` (api `src/lib/__tests__`), vitest (storefront) | backend lib, storefront |
| E2E (against live) | `e2e/` Playwright: checkout, refund, RBAC, seller isolation, onboarding | pre-release |
| Deploy | push `origin/main` → Railway (api) + Vercel (frontends) auto-deploy | everything |

**Definition of done for any feature:** endpoint real + scoped → UI wired with toast/refetch → types clean → production build passes → pushed. Live click-through happens on the deployed stack (task #13 covers the current backlog of that).

---

## 10. Known Gaps (tracked)

| Gap | Task | Severity |
|---|---|---|
| Backend security hardening | #3 | 🔴 launch blocker |
| MoMo async confirmation verified live | #5 | 🔴 launch blocker |
| Live click-through of dashboard actions | #13 | 🔴 launch blocker |
| Shipping zones / stock locations | #4 | 🟠 |
| Auto-payouts on completion | #10 | 🟡 |
| Storefront dead routes / return status | #7 | 🟡 |
| Return-request instant notification | #9 | 🟡 |
| PWA offline | #6 | 🟡 |
| CI/CD + generated shared types | #8 | 🟡 |
| Vendor stock editing | #14 | 🟡 |
| Bundle splitting | #15 | 🟡 |
