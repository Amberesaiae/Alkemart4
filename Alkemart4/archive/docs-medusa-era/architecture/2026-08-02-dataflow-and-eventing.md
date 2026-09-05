# Data Flow & Eventing — Deep Dive

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — as-built |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |
| **Scope** | Every request path, cache, event, job, and side channel in the backend |

---

## 1. Request Paths

### 1.1 Buyer read path (catalog, search, vendor pages)

```
storefront (@medusajs/js-sdk / fetch)
  → GET /store/alkemart/catalog | /store/search | /store/alkemart/vendors | /store/featured-products
    → rateLimit middleware (api/middlewares.ts)
    → catalog cache (lib/catalog-cache.ts, Redis-backed)
        HIT  → serve cached JSON
        MISS → Medusa query.graph → Neon → map (lib/catalog-map.ts) → cache → serve
```

- Cache is invalidated by `subscribers/catalog-cache-invalidate.ts` on product/offer/seller change events.
- Search reads hit the search index (`lib/search/`), which is maintained asynchronously (§3).
- Sellability filtering happens server-side (`lib/product-sellable.ts`): a product only appears if it's published + seller active/ready + priced + stocked.

### 1.2 Buyer write path (cart, checkout, wishlist)

```
storefront → POST /store/ghana-checkout      (lib/ghana-checkout.ts — see order/payment doc)
           → /store/wishlist* (custom module + links, storeWishlistMiddlewares)
           → /store/search/track, /store/search/history (lib/search-history.ts)
```

### 1.3 Vendor path

```
ghana-vendor app → src/lib/api.ts (fetch, credentials) → /vendor/alkemart/*
  → authenticate (Mercur member scope) → seller resolved from auth context
  → EVERY query filtered by seller_id server-side — the client never passes it
```

### 1.4 Admin path

```
admin app → src/lib/api.ts → /admin/* (admin JWT)
  → securityHeaders middleware on all /admin/*
  → route → lib/ or module service
```

### 1.5 External path (webhooks)

```
Paystack → POST /hooks/paystack
  → HMAC signature verification (reject on mismatch)
  → event-ID dedup: Redis SETEX `paystack:dedup:<id>` (TTL) with in-memory fallback
  → dispatch by event type (charge.success → confirmMomoByPaystackReference, …)
  → 200 always returned quickly; heavy work stays in the handler path deliberately small
```

---

## 2. Middleware Stack (`src/api/middlewares.ts` + `src/api/middlewares/`)

| Middleware | Applied to | Purpose |
|---|---|---|
| `authRateLimit` | `/store/auth/*`, `/admin/auth/*`, `/vendor/auth/*` | brute-force protection on login |
| `rateLimit` | public store surfaces (search, catalog, vendors, featured, health) | scraper/flood protection |
| `securityHeaders` | `/admin/*`, `/vendor/*` | HSTS/CSP-grade headers on panels |
| `csrfProtection` | session-authenticated mutations | CSRF |
| `inputSanitize` | mutating routes | payload hygiene |
| `authenticate("member", …, { allowUnregistered: true })` | `/alkemart/member/me` | lets a JWT-holding user who hasn't registered a seller yet get a 404-with-instructions instead of 401 |

**Rule:** new public GET surface ⇒ add `rateLimit`. New panel namespace ⇒ add `securityHeaders`. New session mutation ⇒ CSRF.

---

## 3. Event Bus → Subscribers (all best-effort, never throw)

| Event | Subscriber | Effect |
|---|---|---|
| `order.placed` | `order-lifecycle-notify` | buyer SMS/WA confirm + per-vendor SMS/WA "new order" |
| `order.fulfillment_shipped` | 〃 | buyer SMS |
| `order.fulfillment_delivered` | 〃 | buyer SMS |
| `order.canceled` | 〃 | buyer SMS |
| `order.return_requested` | `return-lifecycle-notify` | **vendor SMS + admin WhatsApp** |
| `order.return_approved` / `return_rejected` | 〃 | buyer SMS (reason included on reject) |
| seller create/approve/suspend | `seller-lifecycle-notify` | seller SMS/WA |
| product create/update/delete | `product-lifecycle-notify`, `search-product-sync`, `search-product-delete` | notify + index |
| offer change | `search-offer-sync` | index price/stock |
| seller change | `search-seller-sync`, `seller-readiness-invalidate` | index + readiness cache bust |
| product/seller/catalog-affecting change | `catalog-cache-invalidate` | Redis cache bust |
| media uploaded | `product-media-pending`, `seller-media-pending` | flag for image jobs |

Design invariants:
- A subscriber failure is logged (`lib/logger.ts`) and swallowed — the commercial transaction must never roll back because an SMS failed.
- Subscribers resolve their own data via `query.graph` — events carry IDs, not payloads.

---

## 4. Scheduled Jobs (`src/jobs/`)

| Job | Cadence | Purpose |
|---|---|---|
| `momo-payment-ttl` | 5 min | expire MoMo payments stuck in `initiated/pending/charged` > 30 min; frees carts/sessions. Uses CART module service — no raw SQL |
| `process-product-images` / `process-seller-images` | scheduled | resize/webp media flagged by the pending subscribers, write back to S3 |
| `recompute-sellable-search` | scheduled | reconcile sellable flags with search index (safety net for missed events) |

**Pattern:** subscribers flag work; jobs do heavy lifting. Never do image processing or bulk recompute inline in a request or subscriber.

---

## 5. Caches & Their Invalidation

| Cache | Home | Invalidated by |
|---|---|---|
| Catalog responses | Redis via `lib/catalog-cache.ts` | `catalog-cache-invalidate` subscriber |
| Seller readiness | `lib/seller-readiness-cache.ts` | `seller-readiness-invalidate` subscriber |
| Seller-owned products | `lib/seller-owned-products-cache.ts` | product/seller mutations |
| Paystack webhook dedup | Redis SETEX (in-memory fallback) | TTL expiry |

**Rule:** every cache must name its invalidation trigger. A cache without a subscriber (or TTL) tied to it is a bug.

---

## 6. Side Channels

- **SMS** — `lib/sms.ts` (AfricasTalking). Primary Ghana channel; templated helpers (`orderConfirmedSms`, `orderShippedSms`, `newOrderVendorSms`, …).
- **WhatsApp** — `lib/whatsapp.ts` (Meta Cloud API). Sent in parallel when `WA_PHONE_NUMBER_ID` configured; template helpers (`waOrderConfirmed`, …).
- **Email** — `lib/email.ts`. Tertiary (receipts).
- **Sentry** — `lib/sentry.ts` backend; `@sentry/react` in storefront.
- **PostHog** — storefront product analytics.
- **Audit log** — `lib/audit-log.ts` for admin-sensitive actions.

---

## 7. Frontend Data Flow (all three apps)

```
component → hook (TanStack Query) → lib/api.ts (single fetch client) → backend
   ▲                                                                     │
   └────────── invalidateQueries / refetch  ◀──── mutation success ◀─────┘
                        + sonner toast (mounted once in routes/__root.tsx)
```

- Query keys are owned by the hooks layer — components never construct keys.
- Mutations: await → toast → invalidate. No optimistic updates unless a doc'd exception.
- The storefront uses `@medusajs/js-sdk` (`src/lib/medusa.ts`) for stock Medusa store APIs and plain fetch for `/store/alkemart/*` customs.
