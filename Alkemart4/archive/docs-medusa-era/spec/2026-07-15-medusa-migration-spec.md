# Alkemart: Express → Medusa v2 Migration Spec

| Field | Value |
|---|---|
| **Title** | Alkemart Migration from Custom Express to Medusa v2 |
| **Date** | 2026-07-15 |
| **Status** | In Progress — SPA decoupled, Medusa backend running, vendor/checkout stubs remain |
| **Codebase** | `/mnt/c/src/Alkemart4` (monorepo), `/home/amber/alkemart-medusa` (Medusa backend) |
| **Medusa Version** | 2.17.2 |
| **Database** | Neon PostgreSQL (serverless, AWS us-east-1) |

---

## 1. Why We Migrated

Alkemart started as a fully custom stack: Express 5 + Drizzle ORM + PostgreSQL API, React + TanStack Router SPA, OpenAPI contracts, CASL abilities, integer pesewas money. The original architecture doc at `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md` defined a 12-PR plan to harden the commercial spine (async MoMo, cancel compensation, settlements, outbox events).

**The strategic pivot**: Instead of building commodity commerce features from scratch (product catalog, cart, order lifecycle, inventory, fulfillment, promotions, auth, admin dashboard), we chose to adopt **Medusa v2** as the commerce engine and keep only our Ghana-specific custom modules as Medusa extensions.

**What Medusa replaces**:
- Product catalog with variants, options, prices
- Cart lifecycle (create, add/update/remove items, complete)
- Order lifecycle (pending → fulfilled → completed)
- Inventory management
- Fulfillment tracking
- Promotions / discount codes
- Price lists
- Auth (email/password, JWT sessions)
- User and role management
- Admin dashboard (React-based)
- 50+ domain events (`order.created`, `product.updated`, etc.)
- Webhook system

**What we keep as custom Medusa modules**:
- `marketplace` — multi-vendor core (Vendor, VendorStaff models)
- `paystack` — Ghana MoMo payment provider
- `settlements` — vendor payout ledger
- `disputes` — order-linked dispute system
- `homepage` — CMS-like section management

---

## 2. Architecture Overview

### Before (Custom Express)
```
SPA (port 5173) ──→ Express API (port 8080) ──→ Drizzle ORM ──→ PostgreSQL
                   /api/* routes
                   OpenAPI codegen → React Query hooks
```

### After (Medusa v2)
```
SPA (port 5173) ──→ Medusa (port 9000)  ──→ MikroORM ──→ Neon PostgreSQL
  │                   /store/*, /admin/*, /auth/*
  │
  ├── Medusa JS SDK (@medusajs/js-sdk ^2.17.2)
  │   → hooks-products.ts (useListProducts, useGetProduct, useListCategories)
  │   → hooks-cart.ts (useGetCart, useCreateCart, useAddCartItem, ...)
  │   → hooks-auth.ts (useLogin, useSignup, useLogout, useGetMe, ...)
  │   → hooks-orders.ts (useListMyOrders, useGetOrder)
  │
  └── api-stubs.ts (legacy hooks → /api/* on old Express :8080)
      → ~40 hooks for admin, vendor, checkout, messaging, homepage CMS
      → Old Express backend currently DOWN — these features broken
```

### Key Decisions
1. **SDK over proxy**: SPA uses `@medusajs/js-sdk` directly cross-origin to `:9000` (Vite proxy configured but SPA router intercepts before proxy fires)
2. **Adapter pattern**: New `hooks-*.ts` files wrap Medusa SDK calls in TanStack Query hooks, matching the same interface the SPA components expect
3. **Stub pattern**: Features not yet migrated to Medusa hit old Express `/api/*` via `api-stubs.ts` — these are typed stubs that return loading states
4. **Publishable API key**: Store routes require `x-publishable-api-key` header — SDK handles this automatically

---

## 3. What Was Done

### Phase 1: Medusa Backend Foundation

**Scaffolded Medusa v2.17.2** at `/home/amber/alkemart-medusa/apps/backend/`.

**medusa-config.ts** — Neon PostgreSQL, CORS for SPA, marketplace module:
```ts
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL, // Neon
    http: { storeCors, adminCors, authCors },
  },
  modules: [
    { resolve: "./src/modules/marketplace" },
  ],
})
```

**20+ Medusa modules migrated** via `medusa db:migrate`:
- product, pricing, inventory, order, cart, region, customer, auth, user, promotion, sales_channel, api_key, store, tax, currency, payment, fulfillment, notification, cache, event_bus, settings, workflows, stock_location

**Custom modules created:**
- `src/modules/marketplace/` — Vendor + VendorStaff models via `model.define()`, MedusaService
- `src/modules/paystack/` — AbstractPaymentProvider implementation (NOT registered in config yet)

**Module links defined:**
- `src/links/vendor-product.ts` — marketplace vendor ↔ product (isList: true)
- `src/links/vendor-order.ts` — marketplace vendor ↔ order (isList: true)

**Scripts created:**
| Script | Purpose | Status |
|---|---|---|
| `seed-ghana.ts` | 12 products, 8 categories, Ghana region, sales channel | **SUCCEEDED** |
| `create-publishable-key.ts` | Link PK to sales channels | **SUCCEEDED** |
| `link-products.ts` | Link products to sales channels | **PARTIAL** |
| `seed-vendors.ts` | 4 test vendors | **FAILED** (module not in container) |

**Ghana test data seeded:**
- 12 products (Samsung Galaxy A15, Infinix Hot 40 Pro, Hisense 43" TV, HP Laptop 15s, Men's Polo T-Shirt, Women's Ankara Dress, Philips Air Fryer, Anker PowerBank, Dettol Soap, Indomie Noodles, JBL Tune 510BT, Xiaomi Redmi Note 13)
- 8 categories (Electronics, Fashion, Home & Garden, Beauty & Health, Groceries, Phones & Tablets, Fashion - Men, Fashion - Women) + 1 subcategory (Smartphones)
- Ghana region with GHS currency
- "Alkemart Storefront" sales channel
- Publishable API key: `pk_674bd275108afae47d4428b0baf40e6f9aff9e83323e794826f0b1125010f7b3`

### Phase 2: SPA Integration

**Medusa JS SDK installed**: `@medusajs/js-sdk@2.17.2` in SPA package.json

**SDK configuration:**
- `src/lib/medusa.ts` — Creates `Medusa({ baseUrl, publishableKey })` singleton
- `src/lib/medusa-provider.tsx` — `MedusaProvider` wraps app in `__root.tsx`, provides `useMedusa()` hook
- `.env` has `VITE_MEDUSA_PUBLISHABLE_KEY=pk_674bd...`

**Vite proxy configured** in `vite.config.ts`:
- `/store/*` → `http://localhost:9000`
- `/admin/*` → `http://localhost:9000`
- `/auth/*` → `http://localhost:9000`
- `/api/*` → `http://127.0.0.1:8080` (old Express)

### Phase 3: Core Hook Migration (4 adapter files)

**hooks-products.ts** — Product catalog via Medusa SDK:
- `useListProducts({ categoryIds, search, limit, offset })` → `GET /store/products`
- `useGetProduct(productId)` → `GET /store/products/{id}`
- `useListCategories()` → `GET /store/product-categories`
- Exports `AlkemartProduct`, `AlkemartProductListItem` types

**hooks-cart.ts** — Cart lifecycle via Medusa SDK:
- `useGetCart()` → `GET /store/carts/{cartId}`
- `useCreateCart()` → `POST /store/carts`
- `useAddCartItem({ variantId, quantity })` → `POST /store/carts/{id}/line-items`
- `useUpdateCartItem({ lineItemId, quantity })` → `POST /store/carts/{id}/line-items/{itemId}`
- `useRemoveCartItem(lineItemId)` → `DELETE /store/carts/{id}/line-items/{itemId}`
- `useListMyAddresses()` → `GET /store/customers/me/addresses`

**hooks-auth.ts** — Customer auth via Medusa SDK:
- `useLogin({ email, password })` → `POST /auth/customer/email_password` + `POST /store/customers/me`
- `useSignup({ email, password, first_name, last_name })` → `POST /auth/customer/email_password`
- `useLogout()` → `DELETE /auth/session`
- `useGetMe()` → `GET /store/customers/me`
- `useUpdateMyProfile(data)` → `POST /store/customers/me`

**hooks-orders.ts** — Order history via Medusa SDK:
- `useListMyOrders()` → `GET /store/me/order`
- `useGetOrder(orderId)` → `GET /store/orders/{id}`
- Exports `OrderStatus` enum (PENDING, COMPLETED, CANCELLED)

### Phase 4: Component & Route Migration (34 files)

**All `@workspace/api-client-react` imports removed** — 0 remaining (verified via grep).

**Components migrated** (now import from local `hooks-*.ts` or `api-stubs.ts`):
- `product-card.tsx` — `id` changed from `number` to `string` (UUIDs)
- `product-rail.tsx` — Local `RailProduct` type, `useAddCartItem`
- `homepage-sections.tsx` — Local `HomepageSection`/`HomepageSectionType` types
- `header-cart-button.tsx` — `useGetCart` from local hooks
- `header-department-nav.tsx` — `useListCategories` from local hooks
- `mini-deals-column.tsx` — `RailProduct` type
- `notification-bell.tsx` — Inlined stubs (no external API)
- `location-chip.tsx` — `useListMyAddresses` from local hooks
- `header-account-menu.tsx` — Local `useMutation` for logout
- `address-form.tsx` — `Address` type from `api-stubs`
- `payment-method-selector.tsx` — `MomoProvider`, `OrderPaymentMethod` from `api-stubs`
- `image-uploader.tsx` — Stubs from `api-stubs`
- `section-config-editor.tsx` — `useListCategories` + stubs
- `admin-analytics-overview.tsx` — Stubs
- `vendor-analytics-overview.tsx` — Stubs
- `vendor-nav.tsx` — Stubs
- `admin-nav.tsx` — `@workspace/abilities` (kept)

**Routes migrated** (now import from local `hooks-*.ts` or `api-stubs.ts`):
- `signin.tsx` — `useLogin` from `hooks-auth`
- `signin_.create.tsx` — `useSignup` from `hooks-auth`
- `signin_.forgot.tsx` — `useForgotPassword` from `api-stubs`
- `signin_.reset.tsx` — `useResetPassword` from `api-stubs`
- `_shop.account.tsx` — `useUpdateMyProfile` from `hooks-auth`
- `_shop.orders.tsx` — `useListMyOrders`, `OrderStatus` from `hooks-orders`
- `_shop.order.$id.tsx` — `useGetOrder` + stubs
- `_shop.checkout.tsx` — Cart/address hooks local, checkout/payment stubs
- `_shop.account.addresses.tsx` — List from local hooks, CUD from stubs
- `_shop.browse.$slug.tsx` — `useListProducts`/`useListCategories` Medusa
- `_shop.ip.$id.tsx` — `useGetProduct`/`useListProducts` Medusa
- `_shop.cart.tsx` — `useGetCart`/`useAddCartItem`/etc. Medusa
- `_shop.store.$slug.tsx` — `useListProducts` Medusa
- `_shop.index.tsx` — Stubs for homepage sections
- `_shop.support.tsx` — Stubs
- All admin routes (`_shop.admin.*.tsx`) — Stubs
- All vendor routes (`_shop.vendor.*.tsx`) — Stubs

### Phase 5: Auth System Migration

**`src/lib/auth.ts`** updated to use Medusa SDK:
- `requireAuthBeforeLoad` fetches customer via `useGetMe` SDK call
- `requireVendorAccessBeforeLoad` / `requireAdminAccessBeforeLoad` — still use `@workspace/abilities` CASL for role checks
- No more `@workspace/api-client-react` imports in auth

---

## 4. What's Left (Blockers & Remaining Work)

### Critical Blockers

#### 4.1 Marketplace Module Not Registering
**Problem**: `container.resolve("marketplaceModuleService")` fails during `medusa exec` scripts.

**Evidence**:
- Module IS defined in `src/modules/marketplace/index.ts` with `Module("marketplace", { service: MarketplaceModuleService })`
- Module IS in `medusa-config.ts` `modules` array
- Migration file exists: `Migration20260715111916.ts` (creates `vendor` and `vendor_staff` tables)
- BUT: `db:migrate` repeatedly fails on Neon (network timeouts — ETIMEDOUT to Neon IPs)
- The marketplace migration may never have been applied to the database
- Without the tables, MikroORM can't initialize the module → container doesn't register it

**Fix needed**:
1. Successfully run `medusa db:migrate` (requires stable Neon connection)
2. OR manually apply the migration SQL via a direct connection
3. Verify `vendor` and `vendor_staff` tables exist

#### 4.2 Paystack Module Not Configured
**Problem**: `src/modules/paystack/` exists with full `AbstractPaymentProvider` implementation but is NOT registered in `medusa-config.ts`.

**Missing env vars**: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`

**Fix needed**:
1. Register in `medusa-config.ts` modules array
2. Add Paystack env vars to `.env`
3. Create `payment` module override to use Paystack as provider

#### 4.3 Link Migrations Not Run
**Problem**: `vendor-product` and `vendor-order` link files exist but their DB tables haven't been created.

**Fix needed**:
1. Run `medusa db:generate` for the links
2. Run `medusa db:migrate`

#### 4.4 Products Missing Category Associations
**Problem**: 9 categories exist, 12 products exist, but NO products are linked to categories.

**Evidence**: `GET /store/products` returns products with empty `categories` array.

**Fix needed**: Re-run `seed-ghana.ts` or create a separate linking script using Medusa's `batchProductProductCategories` API.

### High Priority Remaining Work

#### 4.5 Checkout Flow → Medusa Cart Completion
**Current**: `useCheckout()` in `api-stubs.ts` hits `POST /api/checkout` on old Express.

**Target**: Use Medusa's cart completion flow:
1. `POST /store/carts/{id}/paymentSessions` (add payment session)
2. `POST /store/carts/{id}` (set shipping address, billing address)
3. `POST /store/carts/{id}/complete` (complete cart → creates order)

**Dependencies**: Paystack module must be configured for payment processing.

#### 4.6 Address Management → Medusa Customer Module
**Current**: `useCreateMyAddress()`, `useUpdateMyAddress()`, `useDeleteMyAddress()` in stubs hit old Express.

**Target**: Medusa SDK:
- `POST /store/customers/me/addresses`
- `POST /store/customers/me/addresses/{addressId}`
- `DELETE /store/customers/me/addresses/{addressId}`

#### 4.7 Admin Dashboard → Medusa Admin API
**Current**: All admin routes (`_shop.admin.*.tsx`) use stubs hitting old Express.

**Target**: Use Medusa's built-in admin API:
- `/admin/products` (CRUD)
- `/admin/orders` (list, detail, update)
- `/admin/customers` (list, detail)
- `/admin/promotions` (CRUD)
- `/admin/users` (list, create, update)
- `/admin/regions` (CRUD)
- `/admin/currencies` (list)
- `/admin/stock-locations` (CRUD)
- `/admin/fulfillment` (list, create)

#### 4.8 Vendor Dashboard → Medusa + Marketplace Module
**Current**: All vendor routes use stubs hitting old Express.

**Target**: Medusa SDK for orders/products + marketplace module for vendor-specific data.

#### 4.9 Messaging/Support System
**Current**: Conversations, support tickets, inbox all stubs → old Express.

**Target**: This is a custom feature — no Medusa equivalent. Options:
1. Keep as custom module in Medusa
2. Build as separate microservice
3. Defer to later phase

#### 4.10 Homepage CMS
**Current**: `useListHomepageSections()` → old Express.

**Target**: Custom module or defer.

### Low Priority / Nice-to-Have

- Remove `@workspace/api-client-react` from `package.json` (dead dependency)
- Remove `@workspace/abilities` dependency (inline CASL logic or move to Medusa admin roles)
- Set up Medusa admin dashboard (built-in React admin at `/app`)
- Configure Redis for production (currently uses in-memory fake)
- Set up proper logging
- CI/CD pipeline for Medusa backend

---

## 5. How We Did It (Technical Approach)

### 5.1 WSL Network Challenges

**The single biggest struggle**: npm/bun installs are extremely slow or timeout in WSL.

**Root cause**: WSL2 networking routes through Windows, which adds latency and causes connection resets to npm registry.

**Workarounds discovered**:
- `fnm` (Fast Node Manager) is installed natively at `/home/amber/.local/share/fnm/` — node works at native Linux speed
- `bun` is installed as native Linux ELF binary — runs fast
- `npm install` via Windows interop (`/mnt/c/...`) is extremely slow
- `medusa exec` and `medusa db:migrate` create separate DB connection pools from the running server — these are subject to Neon network flakiness
- The Medusa server on `:9000` connects fine because it maintains a persistent connection pool

**Key lesson**: Always use native Linux paths (`/home/amber/...`) not Windows interop paths (`/mnt/c/...`) for npm operations.

### 5.2 Neon PostgreSQL Connectivity

**Neon** (serverless Postgres) has intermittent connectivity issues from WSL:
- DNS resolution works (resolves to multiple IPs: 54.147.180.180, 3.220.135.142, 52.45.105.76)
- TCP connections sometimes timeout (ETIMEDOUT) or are unreachable (ENETUNREACH for IPv6)
- The running Medusa server connects fine (persistent pool)
- CLI commands (`medusa exec`, `medusa db:migrate`) create fresh connections that fail intermittently

**Impact**:
- `db:migrate` partially succeeds — some modules migrate, others timeout
- `seed-vendors.ts` can't run because the marketplace module's tables may not exist
- Product seeding succeeded on first try (lucky timing)

**Resolution needed**: Either run migrations during a stable network window, or set up a local PostgreSQL for development.

### 5.3 Medusa CLI TypeScript Issues

**ts-node SWC error**: Medusa CLI uses `ts-node` with SWC, which fails in the WSL environment.

**Fix**: Patched Medusa CLI to use `tsx/cjs` as fallback TypeScript loader:
```bash
# In node_modules/.bin/medusa
# Changed ts-node registration to use tsx/cjs
```

### 5.4 Vite Proxy vs SDK Direct Access

**Initial approach**: Configure Vite proxy to forward `/store/*` to `:9000`.

**Problem**: SPA router (TanStack Router) catches routes before Vite proxy fires. A request to `localhost:5173/browse/all` gets handled by the SPA, not proxied.

**Solution**: SPA uses `@medusajs/js-sdk` directly cross-origin to `localhost:9000`. The SDK handles:
- Publishable API key header
- Cart ID cookie
- Session cookies (for authenticated routes)

**CORS configured** in Medusa: `STORE_CORS=http://localhost:5173,http://localhost:8000,http://localhost:9000`

### 5.5 ProductCard ID Type Change

**Problem**: Original `ProductCard` component used `number` for `id` (Drizzle integer IDs). Medusa uses UUID strings.

**Fix**: Changed `ProductCardProps.id` from `number` to `string`. Removed `hashCode(uuid)` function that was converting UUIDs to numbers.

### 5.6 Medusa v2 API Conventions

**Discovered patterns** (not documented well):
- Module methods use singular form: `listRegions()` not `list(RegionModule)`
- Module resolution requires `Modules.*` constants: `Modules.REGION`, `Modules.PRODUCT`, etc.
- Product↔SalesChannel linking: `updateProducts({ sales_channels })` does NOT create junction table entries — must use raw SQL or module link API
- `medusa exec` syntax requires `./` prefix and `.ts` extension: `medusa exec ./src/scripts/seed-ghana.ts`
- Store routes require `x-publishable-api-key` header
- SDK automatically handles this when configured with `publishableKey`

### 5.7 MedusaProvider Memoization

**Problem**: SDK instance was being recreated on every render, causing infinite re-fetch loops.

**Fix**: Memoize the SDK client in `medusa-provider.tsx`:
```tsx
const sdk = useMemo(() => new Medusa({ baseUrl, publishableKey }), [])
```

Also memoize the `MedusaProvider` component itself to prevent re-renders from recreating the context.

---

## 6. Struggles & Gotchas

### 6.1 The "marketplaceModuleService not found" Mystery

**Time spent**: ~2 hours

**What we tried**:
1. Registered module in `medusa-config.ts` ✅
2. Created proper `Module("marketplace", { service })` export ✅
3. Generated migration file ✅
4. Ran `db:migrate` — failed on other modules (Neon timeout) before reaching marketplace
5. Tried `medusa exec` scripts — container doesn't have the service
6. Verified models use `model.define()` (Medusa v2 pattern) ✅

**Root cause hypothesis**: The migration was never applied. Without the `vendor` table, MikroORM can't initialize the MarketplaceModuleService, and Medusa silently skips registering it.

**Status**: Unresolved. Requires either stable DB connection for migration, or manual SQL execution.

### 6.2 Neon Connection Pool Exhaustion

Each `medusa exec` or `medusa db:migrate` command creates a NEW connection pool (20+ connections). Neon's serverless driver has connection limits. Running multiple CLI commands in quick succession exhausts the pool, causing ETIMEDOUT errors.

**Workaround**: Run one command at a time, wait for completion before running next.

### 6.3 npm install Timeout on Large Packages

`@swc/core` (required by Medusa CLI) is ~40MB and times out during install.

**Workaround**: Patched Medusa CLI to use `tsx/cjs` instead of `@swc/core`.

### 6.4 Dual Backend Reality

The SPA is currently **dual-homed**:
- Medusa `:9000` handles: products, cart, customer auth, orders
- Old Express `:8080` handles: admin, vendor, checkout, messaging, homepage CMS, images, disputes, promotions

The old Express backend is **currently DOWN** (not running). This means:
- Admin dashboard: BROKEN
- Vendor dashboard: BROKEN
- Checkout completion: BROKEN
- Messaging: BROKEN
- Homepage sections: BROKEN
- Password reset: BROKEN (stubs return error states)

Only product browsing, cart management, and basic auth pages work.

### 6.5 @workspace/api-client-react Removal

The generated React Query hooks from the old OpenAPI spec are completely unused now. However, the package is still in `package.json` as a devDependency. It can be safely removed once all features are migrated to Medusa.

The `@workspace/abilities` package (CASL role definitions) is still actively used by 3 files for admin/vendor role checks. This is a workspace package that resolves to local TypeScript source — it works but won't survive a production build outside the monorepo.

### 6.6 Product Categories Not Linking

The `seed-ghana.ts` script creates products and categories separately. The `batchProductProductCategories` API call to link them may have failed silently. The Medusa API confirms 9 categories exist but 0 products have category associations.

---

## 7. File Inventory

### Medusa Backend (`/home/amber/alkemart-medusa/apps/backend/`)

| File | Purpose |
|---|---|
| `medusa-config.ts` | Main config — DB, CORS, modules |
| `.env` | Neon URL, CORS, secrets |
| `src/modules/marketplace/index.ts` | Module registration |
| `src/modules/marketplace/service.ts` | MedusaService(Vendor, VendorStaff) |
| `src/modules/marketplace/models/vendor.ts` | Vendor model (slug, name, bio, rating, badges, commission, status) |
| `src/modules/marketplace/models/vendor-staff.ts` | VendorStaff model (role) |
| `src/modules/marketplace/migrations/Migration20260715111916.ts` | Creates vendor + vendor_staff tables |
| `src/modules/paystack/` | Paystack payment provider (NOT registered) |
| `src/links/vendor-product.ts` | Vendor ↔ Product link |
| `src/links/vendor-order.ts` | Vendor ↔ Order link |
| `src/scripts/seed-ghana.ts` | Seeds 12 products, 8 categories, Ghana region |
| `src/scripts/create-publishable-key.ts` | Creates/links publishable API key |
| `src/scripts/link-products.ts` | Links products to sales channels |
| `src/scripts/seed-vendors.ts` | Seeds 4 test vendors (FAILING) |

### SPA (`/mnt/c/src/Alkemart4/artifacts/alkemart/`)

| File | Purpose |
|---|---|
| `src/lib/medusa.ts` | SDK singleton |
| `src/lib/medusa-provider.tsx` | MedusaProvider + useMedusa() hook |
| `src/lib/hooks-products.ts` | Product adapter hooks (Medusa SDK) |
| `src/lib/hooks-cart.ts` | Cart adapter hooks (Medusa SDK) |
| `src/lib/hooks-auth.ts` | Auth adapter hooks (Medusa SDK) |
| `src/lib/hooks-orders.ts` | Order adapter hooks (Medusa SDK) |
| `src/lib/api-stubs.ts` | Legacy stubs (~40 hooks → old Express /api) |
| `src/lib/api-extra.ts` | Additional legacy stubs |
| `src/lib/auth.ts` | Auth helpers (uses Medusa SDK + CASL) |
| `src/lib/api-url.ts` | API URL helper for old Express |
| `vite.config.ts` | Vite config with proxy rules |
| `.env` | `VITE_MEDUSA_BACKEND_URL`, `VITE_MEDUSA_PUBLISHABLE_KEY` |

---

## 8. Running State

| Service | Port | Status | Notes |
|---|---|---|---|
| Medusa Backend | 9000 | **RUNNING** | `http://localhost:9000/health` → OK |
| SPA Dev Server | 5173 | **RUNNING** | `http://localhost:5173` → HTML |
| Old Express API | 8080 | **DOWN** | All stub-dependent features broken |
| Neon PostgreSQL | 5432 | **FLAKY** | Works from server, intermittent from CLI |

### Verified API Endpoints

| Endpoint | Method | Auth | Result |
|---|---|---|---|
| `/health` | GET | None | `OK` |
| `/store/products` | GET | PK header | 12 products, GHS prices |
| `/store/product-categories` | GET | PK header | 9 categories |
| `/store/customers/me` | GET | Session | Empty (no session) |

---

## 9. Next Session Priorities

1. **Fix marketplace module registration** — Run migration or manually create tables
2. **Migrate checkout to Medusa** — Cart completion + Paystack payment
3. **Migrate address management** — Medusa customer addresses API
4. **Migrate admin dashboard** — Medusa admin API
5. **Re-link products to categories** — Fix missing associations
6. **Configure Paystack module** — Register in config + add env vars
7. **Start old Express backend** temporarily to unblock stubs while migrating
