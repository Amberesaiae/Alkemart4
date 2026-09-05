# Canonical Data Flow — Alkemart4
> Date: 2026-08-02 | Ground truth from full codebase audit

---

## 0. System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PACKAGES (shared workspace — no runtime server)                             │
│  packages/shared  (@alkemart/shared)   — Ghana locale, currency, phone,     │
│                                          address, payment types              │
│  packages/ui      (@workspace/ui)       — React component library            │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────┐    ┌────────────────────────┐   ┌──────────────────┐
│  apps/storefront       │    │  apps/backend/apps/     │   │ apps/backend/    │
│  Vite + React PWA      │    │  admin   (React/Vite)   │   │ apps/ghana-vendor│
│  Port 5175 → Vercel    │    │  Port 3001 → Railway    │   │ Port 3002        │
│  Buyer surface         │    │  Admin surface          │   │ Vendor surface   │
└──────────┬─────────────┘    └──────────┬──────────────┘   └────────┬─────────┘
           │                             │                            │
           └─────────────────────────────┴────────────────────────────┘
                                         │ HTTP/REST
           ┌─────────────────────────────▼────────────────────────────┐
           │  apps/backend/packages/api  (Medusa v2 + Mercur v2.2)    │
           │  Port 9000 → Railway                                      │
           │  ┌──────────────────────────────────────────────────────┐│
           │  │  Core Medusa (cart, order, product, inventory, etc.)  ││
           │  │  Mercur layer (seller, offer, commission, payout)     ││
           │  │  Alkemart extensions (ghana-checkout, catalog, etc.)  ││
           │  └──────────────────────────────────────────────────────┘│
           └────┬──────────┬──────────┬──────────┬──────────┬─────────┘
                │          │          │          │          │
             Neon DB    Redis      Meilisearch  Paystack  AT/Meta
            (pooled)  (cache/jobs) (search)    (payment) (SMS/WA)
```

---

## 1. Entity Model

### 1.1 Native Medusa v2 Entities (DB-authoritative, not seeded at runtime)

| Entity | Key fields | Admin-configurable? |
|---|---|---|
| **Region** | currency_code, countries | ✅ Medusa admin |
| **SalesChannel** | name, is_disabled | ✅ Medusa admin |
| **Category** | name, handle, rank | ✅ Medusa admin (seeded once by ensure-ghana-categories) |
| **Product** | title, status, metadata.alkemart.quality | ✅ Vendor creates, Admin approves |
| **ProductVariant** | title, sku, inventory_quantity | ✅ Via product |
| **PriceList / Price** | amount, currency_code | Via Mercur offers |
| **Cart** | metadata.ghana_payment (state machine), metadata.ghana_payment_status | Buyer-driven |
| **Order** | status, items, total | Medusa core |
| **Customer** | email, phone, metadata | Buyer self-manages |
| **StockLocation** | name, address | ✅ Admin (CRITICAL: currently zero configured) |
| **ShippingOption** | name, price_type, amount | ✅ Admin (CRITICAL: currently zero configured) |
| **FulfillmentProvider** | id | Config-only |
| **ReturnReason** | label, value | ✅ Admin |

### 1.2 Mercur v2 Entities (via @mercurjs/core)

| Entity | Key fields | Admin-configurable? |
|---|---|---|
| **Seller** | name, handle, status, commission_bps, metadata | ✅ Admin approve/suspend |
| **Member** | seller_id, actor_id, role | Created on vendor registration |
| **Offer** | seller_id, product_id, prices, inventory | Vendor manages |
| **CommissionRate** | name, type, value, currency_code | ✅ Admin via `/admin/commission-rates` |
| **Payout** | seller_id, amount, status, period | ✅ Admin trigger via `/admin/payouts` |
| **PayoutAccount** | seller_id, data (Paystack recipient) | Vendor sets up via onboarding |

### 1.3 Custom Alkemart Entities

| Entity | Location | Key fields | Notes |
|---|---|---|---|
| **Wishlist** | `modules/wishlist` | id, reference | Linked to Customer 1:1 |
| **WishlistProduct link** | `links/wishlist-product` | wishlist_id, product_id | M:N |
| **CustomerWishlist link** | `links/customer-wishlist` | customer_id, wishlist_id | 1:1 |

### 1.4 What Is DB-Driven vs. Hardcoded

| Config | Source | Editable without deploy? |
|---|---|---|
| Operating markets (countries) | Medusa **Regions** (DB) | ✅ Yes |
| Currency | Region.currency_code (DB) | ✅ Yes |
| Ghana address field config | `lib/operating-markets.ts` (code) | ❌ Requires redeploy |
| Ghana region names (16) | `@alkemart/shared/ghana/regions.ts` (code) | ❌ Fixed geography |
| Commission rates | Mercur `commission_rate` table (DB) | ✅ Yes |
| Shipping options | Medusa `shipping_option` table (DB) | ✅ **BUT: none configured yet** |
| Featured products | `featured_product` Mercur entity (DB toggle) | ✅ Admin toggle |
| Product categories | Medusa `product_category` (DB, seeded once) | ✅ Yes after initial seed |
| Paystack API URLs | `lib/paystack-client.ts` (hardcoded) | ❌ Reasonable — external SaaS |
| MoMo TTL (30 min) | `lib/ghana-checkout.ts` constant | ❌ Requires redeploy |
| Vendor onboarding checklist items | `lib/seller-readiness.ts` (code) | ❌ Requires redeploy |

---

## 2. Complete Lifecycle Flows

### 2.1 Vendor Onboarding → First Listing

```
Vendor registers (POST /vendor/auth/emailpass/register)
  │  Medusa creates: customer record, auth_identity
  │  Mercur creates: seller (status=pending_approval), member
  │  Subscriber: seller-lifecycle-notify → SMS to vendor
  ▼
Admin approves (POST /admin/alkemart/sellers/:id/approve)
  │  Mercur: approveSellersWorkflow → seller.status=open
  │  Subscriber: seller-readiness-invalidate → clears seller cache
  │  Subscriber: seller-lifecycle-notify → SMS/WhatsApp to vendor
  │  Subscriber: search-seller-sync → upserts Meilisearch doc
  ▼
Vendor completes Ghana setup (POST /vendor/alkemart/onboarding/ghana-setup)
  │  runGhanaSellerSetup() creates:
  │    - StockLocation (if not exists) ← currently this is a ghost call
  │    - ShippingProfile
  │    - Links seller to sales channel
  │  Vendor checklist: profile ✓, address ✓
  ▼
Vendor quick-lists product (POST /vendor/alkemart/quick-list)
  │  STEP 1: createProductsWorkflow (Mercur)
  │    Hook: productsCreated → link product_id ↔ seller_id
  │    Hook: validate → score product quality (metadata.alkemart.quality)
  │    Result: product with status=proposed
  │  STEP 2: createOffersWorkflow (Mercur)
  │    Creates offer per variant (price, stock, seller_id)
  │    Hook: validate → evaluateSellerReadiness (canSell gate)
  │    If STEP 2 fails → manual cleanup: dismiss link, deleteProducts
  │  Subscriber: search-product-sync → indexes in Meilisearch
  │  Subscriber: catalog-cache-invalidate → busts Redis catalog cache
  ▼
Admin moderates (POST /admin/alkemart/products/:id/approve)
  │  Sets product.status = published
  │  Subscriber: product-lifecycle-notify → SMS/Email to vendor
  │  Subscriber: search-product-sync → updates Meilisearch (now visible)
  │  Subscriber: catalog-cache-invalidate → busts cache
  ▼
Product visible in storefront catalog
```

**Atomicity gaps in this flow:**
- STEP 2 failure in quick-list: manual rollback (not Medusa workflow compensation) — can orphan products if cleanup fails
- Subscribers all fail silently (logged) — Meilisearch/SMS/cache can diverge from DB
- Ghana setup stock location creation: currently doesn't work because no shipping zones exist

### 2.2 Buyer Checkout → Order

```
Buyer adds to cart (Medusa SDK: POST /store/carts/:id/line-items)
  │  Medusa validates: product published, variant has offer
  │  Cart lines include seller_id via Mercur enrichment
  ▼
Buyer submits checkout (POST /store/ghana-checkout)
  │  runGhanaCheckout(scope, { cartId, paymentMethod, ... })
  │
  ├─ COD path:
  │    createPaymentCollectionForCartWorkflow
  │    createPaymentSessionsWorkflow (pp_system_default)
  │    [transferCartCustomerWorkflow if customerId]
  │    completeCartWorkflow → Order created in DB
  │    Result: { status: "completed", order_id }
  │    Subscriber: order-lifecycle-notify → SMS/WhatsApp to buyer
  │
  ├─ MoMo path (Paystack):
  │    createPaymentCollectionForCartWorkflow
  │    chargeMobileMoney(paystackKey, phone, provider, amountPesewas, ref)
  │      → POST https://api.paystack.co/charge (MoMo)
  │      If sync success → complete cart immediately (same as COD)
  │      If pending/send_otp → set cart metadata:
  │        ghana_payment = "momo"
  │        ghana_payment_status = "initiated" → "pending"
  │        ghana_expires_at = now + 30min
  │        ghana_charge_ref = paystackRef
  │      Result: { status: "payment_pending", cart_id, client_reference }
  │      [Webhook path] POST /store/ghana-checkout/webhook ← MISSING
  │      [TTL job] momo-payment-ttl (*/5 min) expires stale carts
  │
  └─ Card path (Paystack):
       createPaymentCollectionForCartWorkflow
       POST https://api.paystack.co/transaction/initialize
         → authorization_url
       Result: { status: "card_redirect", authorization_url }
       Buyer redirects → Paystack → callback_url
       GET /store/ghana-checkout/status?ref=... → verifyPaystackTransaction
         If success → completeCartWorkflow → Order

STATE MACHINE for cart.metadata.ghana_payment_status:
  initiated → pending → succeeded → completed
  initiated → pending → charge_failed
  initiated → charged → succeeded → completed
  any → expired (TTL job)
  succeeded → refunded
```

**Atomicity analysis:**
- COD: Fully transactional within `completeCartWorkflow` (Medusa Saga)
- MoMo sync success: Same transactional path as COD ✓
- MoMo async: The Paystack webhook endpoint does NOT exist — async payments have no completion path except manual verification via polling
- Card: The `verifyPaystackTransaction` → `completeCartWorkflow` path works but the callback URL verification relies on query params that could be tampered with (should verify Paystack signature on the callback)

### 2.3 Order Fulfillment

```
Order placed → order.status = pending
  ▼
Vendor views order in ghana-vendor dashboard
  │  GET /vendor/orders → filtered by seller_id
  ▼
Vendor creates fulfillment (POST /vendor/orders/:id/fulfillments)
  │  Medusa: creates fulfillment record, reserves stock
  │  order.fulfillment_status = partially_fulfilled | fulfilled
  ▼
Vendor marks shipped (POST /vendor/orders/:id/fulfillments/:fid/shipment)
  │  Optionally: tracking_number, tracking_url
  │  Subscriber: order-lifecycle-notify → SMS "Your order shipped"
  ▼
Vendor marks delivered OR buyer confirms receipt
  └─ order.status transitions to completed

GAPS:
  - No automated stock deduction on order placement (relies on Medusa inventory)
  - No carrier/3PL integration — all manual
  - No split order model decided: currently one Medusa order with all lines
    regardless of vendor count
```

### 2.4 Return Flow

```
Buyer submits return (POST /store/orders/:id/returns — Medusa SDK)
  │  Creates return record with items and reason
  │  Current behavior: form submits, buyer sees nothing afterward
  ▼
[NO SUBSCRIBER FOR RETURN EVENTS]
  │  Admin sees return in admin dashboard (returns.tsx)
  │  Vendor sees return in vendor dashboard (returns.tsx via /vendor/alkemart/returns)
  ▼
Admin/vendor processes return (currently manual only)
  └─ No automated refund trigger
  └─ No buyer status update
  └─ Dispute path is orphaned (backend /admin/disputes exists, no UI)
```

### 2.5 Payout Flow

```
Order completed → commission calculated by Mercur (commission_rate table)
  ▼
Admin views payout summary (GET /admin/payouts)
  │  ← LIST ROUTE MISSING (only /admin/payouts/:id exists)
  │  Currently: admin dashboard payouts page → 404 on list
  ▼
Admin triggers payout (currently manual only — no automated trigger)
  │  POST /admin/payouts → createPayout via paystack-payout module
  │  paystack-payout → POST https://api.paystack.co/transfer
  │  Paystack → webhook transfer.success
  │  paystack-payout webhook handler → update Mercur payout status
  ▼
Seller payout account must exist first:
  Vendor completes onboarding → POST /vendor/alkemart/onboarding/ghana-setup
    → runGhanaSellerSetup → createPayoutAccount → POST /transferrecipient
    → Stores Paystack recipient_code in payout_account.data
```

---

## 3. Workflow & Subscriber Map

### 3.1 Medusa Workflows Used

| Workflow | Provider | Call site | Has compensation? |
|---|---|---|---|
| `completeCartWorkflow` | Medusa core | `ghana-checkout.ts` | ✅ Medusa Saga |
| `createPaymentCollectionForCartWorkflow` | Medusa core | `ghana-checkout.ts` | ✅ |
| `createPaymentSessionsWorkflow` | Medusa core | `ghana-checkout.ts` | ✅ |
| `transferCartCustomerWorkflow` | Medusa core | `ghana-checkout.ts` | ✅ |
| `createProductsWorkflow` | Mercur | `quick-list/route.ts`, hooks | ✅ Mercur |
| `createOffersWorkflow` | Mercur | `quick-list/route.ts` | ✅ Mercur (but not wired to product cleanup) |
| `updateOffersWorkflow` | Mercur | `products/[id]/route.ts` | ✅ Mercur |
| `approveSellersWorkflow` | Mercur | `admin/sellers/[id]/approve` | ✅ Mercur |
| `suspendSellersWorkflow` | Mercur | `admin/sellers/[id]/suspend` | ✅ Mercur |
| `createCommissionRatesWorkflow` | Mercur | `admin/commission-rates` | ✅ Mercur |
| `create-wishlist` | Custom | `store/wishlist/route.ts` | ❌ No compensation |
| `delete-wishlist` | Custom | `store/wishlist/product/[id]` | ❌ No compensation |

### 3.2 Subscriber Map

| Subscriber file | Events | Actions | Failure mode |
|---|---|---|---|
| `catalog-cache-invalidate` | product.*, offer.*, seller.* | invalidateCatalogCache (Redis) | Silent (logged) |
| `seller-readiness-invalidate` | seller.updated/approved/suspended/etc | invalidateSellerReadiness (in-memory) | Silent (logged) |
| `order-lifecycle-notify` | order.placed/shipped/delivered/canceled | SMS + WhatsApp + Email | Silent (logged) |
| `product-lifecycle-notify` | product.published/rejected/change-requested | Email + SMS to seller | Silent (logged) |
| `product-media-pending` | product.created | Queues image processing | Silent (logged) |
| `seller-media-pending` | seller.created | Queues seller image processing | Silent (logged) |
| `search-product-sync` | product.* | Meilisearch upsert | Silent (logged) |
| `search-product-delete` | product.deleted | Meilisearch delete | Silent (logged) |
| `search-offer-sync` | offer.* | Meilisearch offer index | Silent (logged) |
| `search-seller-sync` | seller.* | Meilisearch seller index | Silent (logged) |

**Critical gap:** No retry mechanism on any subscriber. If Meilisearch is down when a product is published, the search index will be permanently out of sync until the 15-minute recompute job runs.

### 3.3 Scheduled Jobs

| Job | Schedule | What it does | Risk |
|---|---|---|---|
| `momo-payment-ttl` | */5 min | Expires abandoned MoMo carts | Uses raw SQL `knex.raw()` — bypasses ORM |
| `process-product-images` | */5 min | Generates WebP derivatives | Silent failures |
| `process-seller-images` | */5 min | Generates seller avatar derivatives | Silent failures |
| `recompute-sellable-search` | */15 min | Full Meilisearch reindex (safety net) | Heavy: reindexes everything every 15min |

### 3.4 Workflow Hooks (createProductsWorkflow extensions)

| Hook | What it does |
|---|---|
| `productsCreated` | Links product ↔ seller in Mercur graph |
| `validate` (create) | Scores product quality via `lib/product-quality.ts` |
| `validate` (offers create) | Evaluates seller readiness: is_approved + setup_complete + canSell gates |
| `validate` (offers update) | Soft gate (advisory, not hard block) |

---

## 4. Redundancies Found and Corrections

### 4.1 Ghana locale — 3 copies of the same data (FIXED in this commit)

**Before (broken):**
```
packages/shared/src/ghana/regions.ts     ← canonical (rich Region objects)
packages/api/src/lib/ghana-locale.ts    ← copy (flat string array)
apps/storefront/src/lib/ghana-locale.ts ← copy (flat string array)
apps/ghana-vendor/src/lib/ghana.ts      ← copy (acknowledges it's a copy)
```

**After (correct):**
```
packages/shared/src/ghana/regions.ts    ← single source of truth
  ↑ imported by all three consumers
```

### 4.2 MomoProvider type — 2 conflicting definitions (FIXED)

`packages/shared/src/ghana/payment.ts` had `"MTN" | "VODAFONE" | "AIRTELTIGO"` (uppercase)
but Paystack API and all runtime code uses `"mtn" | "vodafone" | "airteltigo"` (lowercase).

Fixed: shared package now exports the Paystack-canonical lowercase type.

### 4.3 Missing `/admin/payouts` list route (FIXED)

Only `GET /admin/payouts/:id` existed. Admin dashboard `payouts.tsx` calls `GET /admin/payouts`
(list). Added the list route.

### 4.4 `momo-payment-ttl` uses `knex.raw()` (FIXED)

Direct SQL bypasses the Medusa service layer. Fixed to use `query.graph` for reads
and the cart module service for writes.

### 4.5 Stale TODO comment in `ghana-checkout.ts` (FIXED)

Comment said "TODO: Add scheduled job to clean up expired pending payments"
but `momo-payment-ttl.ts` already exists and handles this. Removed stale TODO.

### 4.6 AddressFieldSpec — 2 definitions (partially fixed)

`apps/storefront/src/lib/markets.ts` and `packages/api/src/lib/operating-markets.ts`
define the same `AddressFieldSpec` type. The storefront one should import from `@alkemart/shared/ghana`.
Full migration tracked as a follow-up (requires updating all call sites).

### 4.7 Duplicate Order/Seller address types across dashboards

`admin/src/lib/api.ts` and `ghana-vendor/src/lib/api.ts` both define `SellerAddress`, `OrderAddress`.
These should come from `@alkemart/shared/ghana/address.ts` (GhanaAddress is equivalent).
Full migration tracked as follow-up.

---

## 5. Editability Matrix

| What | How to change | Who |
|---|---|---|
| Commission rate | POST /admin/commission-rates | Admin |
| Product category | POST /admin/product-categories | Admin |
| Featured products | POST /admin/featured-products/:id/toggle | Admin |
| Market/region | Medusa Admin → Regions | Admin |
| Shipping option | Medusa Admin → Settings → Shipping | Admin (**none configured!**) |
| Stock location | Medusa Admin → Settings → Locations | Admin (**none configured!**) |
| Seller commission | PATCH /admin/sellers/:id (commissionBps) | Admin |
| Return reasons | Medusa Admin → Settings → Return Reasons | Admin |
| MoMo TTL (30 min) | Change constant in `ghana-checkout.ts` | Developer deploy |
| Ghana address fields | Change `operating-markets.ts` | Developer deploy |
| Vendor checklist items | Change `seller-readiness.ts` | Developer deploy |

---

## 6. The Mercur Interface Surface

Mercur is used as a **data model and workflow layer**. It is NOT used for UI (custom admin/vendor replace it).

Mercur owns these tables: `seller`, `member`, `offer`, `commission_rate`, `payout`, `payout_account`
Mercur provides these workflows: product create/update, offer CRUD, seller approve/suspend, commissions
Mercur injects: admin-ui module (overridden by custom admin), vendor-ui module (overridden by ghana-vendor)

**What Mercur locks down:**
- Product-to-seller association model (product_seller join via Mercur graph)
- Offer price model (offers own the price, not the product variant)
- Seller approval flow (state machine: pending → open | suspended | terminated)
- Commission calculation (commission_rate table, applied at payout time)

**How to work with Mercur rigidity:**
- Never bypass Mercur's seller link (use `createProductsWorkflow`, not raw product create)
- Extend via hooks (`createProductsWorkflow.hooks.productsCreated`, etc.)
- Add custom routes for Ghana-specific behaviors (`/vendor/alkemart/*`, `/store/alkemart/*`)
- Use Mercur's query graph for all reads (it joins seller/offer context automatically)

---

## 7. Known Gaps That Need Tasks

1. **Shipping zones**: Zero configured. Checkout silently has no options. (Task #4)
2. **MoMo Paystack webhook**: No webhook endpoint. Async MoMo payments cannot complete. (Task #5)
3. **Security**: Debug routes in production, auth fallback. (Task #3)
4. **PWA**: Manifest and SW not implemented. (Task #6)
5. **Admin payouts list route**: Added in this commit, but no UI for triggering payouts.
6. **Return subscriber**: No `order.return_requested` subscriber → vendor/admin not notified.
7. **Dispute UI**: `/admin/disputes` backend exists, no admin UI page.
8. **Wishlist compensation**: `create-wishlist` workflow has no compensation steps.
9. **Full-catalog reindex**: Every 15 minutes is expensive. Should be event-driven only.
10. **Seller onboarding stock location**: `ghana-seller-setup.ts` creates a stock location
    but shipping options on that location are never created → sellers end up with locations
    but no callable shipping options.
