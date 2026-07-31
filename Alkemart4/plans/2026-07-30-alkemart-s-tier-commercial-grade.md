# Alkemart — S-Tier Commercial-Grade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement plan task-by-task.

**Goal:** Bring Alkemart to S-tier commercial-grade readiness — fix all security emergencies, wire all broken admin pages, patch all vendor portal bugs, harden payment flows, and verify with E2E tests.

**Architecture:** MedusaJS v2 backend (Mercur marketplace plugin) + React (TanStack Router) admin dashboard + React (TanStack Router) vendor portal. PostgreSQL (Neon), Redis (Upstash), Meilisearch, Paystack payments, S3/R2 file storage.

**Tech Stack:** TypeScript, MedusaJS v2, MercurJS, React 18, TanStack Router, TanStack Query, Zod, Jest, Paystack API, Neon PostgreSQL, Upstash Redis.

## Global Constraints

- All secrets via environment variables only — never in source code
- Every route that mutates state must have CSRF protection or be authenticated
- Every public endpoint must have rate limiting
- All database queries must use parameterized queries (Medusa Query Graph or raw parameterized SQL)
- No paginated list may load all records into memory before filtering
- Audit logs must use the real authenticated actor ID, never "admin"
- Vendor portal nav must use basepath-relative path comparison

---

## Phase 0: Security Emergency

These are production-disaster items. Fix in order — each is independently mergeable and independently testable.

### Task 0.1: Remove hardcoded credentials from debug routes

**Files:**
- Modify: `packages/api/src/api/alkemart/debug-auth/route.ts`
- Modify: `packages/api/src/api/alkemart/debug-store/route.ts`
- Modify: `packages/api/src/api/alkemart/set-passwords/route.ts`
- Modify: `packages/api/src/api/alkemart/migrate-data/route.ts`

**Context brief:** Four debug routes contain live Neon database connection strings with passwords in plaintext. Any unauthenticated GET request to `/alkemart/debug-auth` dumps the entire `auth_identity` and `provider_identity` tables. `set-passwords` has a hardcoded shared secret (`alkemart-fix-2026`) that resets ALL users' password to `"test123"`.

**Solution:** Gate all debug routes behind `NODE_ENV !== 'production'` check at the top of each handler. For routes that still have value in dev, replace hardcoded credentials with env vars. Add authentication check for `set-passwords`.

- [ ] **Step 1: Read each debug route file** — extract hardcoded connection strings and shared secrets
- [ ] **Step 2: Gate behind NODE_ENV check** — Add at top of each handler:
```typescript
if (process.env.NODE_ENV === "production") {
  res.status(403).json({ error: "Not available in production" })
  return
}
```
- [ ] **Step 3: Replace hardcoded credentials** — Move Neon credentials to env vars (`DEBUG_DATABASE_URL`), move shared secret to env var (`DEBUG_SECRET`)
- [ ] **Step 4: Verify** — `bun run test:unit` passes. Routes respond with `403` when NODE_ENV=production

**Verification:** `bun run test:unit` passes. Routes return 403 (not 404 — semantically correct for "route exists but disabled") when `NODE_ENV=production`.

### Task 0.2: Register safety middleware globally

**Files:**
- Read: `packages/api/src/api/middlewares.ts`
- Read: `packages/api/src/api/middlewares/security-headers.ts`
- Read: `packages/api/src/api/middlewares/csrf-protection.ts`
- Read: `packages/api/src/api/middlewares/input-sanitize.ts`
- Modify: `packages/api/src/api/middlewares.ts`

**Context brief:** `middlewares.ts` only registers wishlist routes and the member/me auth middleware. The `csrf-protection.ts`, `security-headers.ts`, and `input-sanitize.ts` middlewares that exist in the `middlewares/` directory are **not registered** — they are dead code. Every POST/PUT/DELETE route is vulnerable to CSRF. No CSP or HSTS headers are set.

**Interfaces:**
- Consumes: `security-headers.ts` exports `applySecurityHeaders(req, res, next)`
- Consumes: `csrf-protection.ts` exports `csrfProtection(req, res, next)`
- Produces: registered middleware that runs on all matching routes

- [ ] **Step 1: Read existing middleware files**

Read `middlewares.ts`, `security-headers.ts`, `csrf-protection.ts`, `input-sanitize.ts` to understand their signatures and registration API.

- [ ] **Step 2: Update `middlewares.ts`**

```typescript
// Add to middlewares.ts after existing registrations:
import { applySecurityHeaders } from "./middlewares/security-headers"
import { csrfProtection } from "./middlewares/csrf-protection"
import { inputSanitizer } from "./middlewares/input-sanitize"

// Global security headers on all responses
export const config: MiddlewaresConfig = {
  routes: [
    // ...existing routes...
    
    // Security headers on all routes
    {
      matcher: "/admin/*",
      middlewares: [applySecurityHeaders],
    },
    {
      matcher: "/vendor/*",
      middlewares: [applySecurityHeaders],
    },
    {
      matcher: "/store/*",
      middlewares: [applySecurityHeaders],
    },
    
    // CSRF protection on state-changing admin/vendor routes
    {
      matcher: "/admin/*",
      method: ["POST", "PUT", "DELETE"],
      middlewares: [csrfProtection],
    },
    {
      matcher: "/vendor/*",
      method: ["POST", "PUT", "DELETE"],
      middlewares: [csrfProtection],
    },
    
    // Input sanitization on all routes
    {
      matcher: "/*",
      middlewares: [inputSanitizer],
    },
  ],
}
```

(Following the MedusaJS middleware registration API. Actual config shape may differ — align with existing middleware structure.)

- [ ] **Step 3: Enhance `security-headers.ts`**

Add:
```
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.paystack.com https://*.meilisearch.io;
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Keep existing headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`).

**IMPORTANT:** The `connect-src` directive must match the actual deployment's API origin. The example above includes Paystack and Meilisearch domains. When deploying, verify against the production `window.location.origin` and add any additional origins needed (Neon, CDN, etc.). Use CSP reporting mode first to detect violations before enforcing.

- [ ] **Step 4: Verify**

Run: `bun run test:unit` — all tests pass.

- [ ] **Step 5: Commit**

```
git add packages/api/src/api/middlewares.ts packages/api/src/api/middlewares/
git commit -m "fix(security): register CSRF, security headers, input sanitizer middlewares globally"
```

### Task 0.3: Rate limiting on critical public endpoints

**Files:**
- Modify: `packages/api/src/api/store/search/route.ts`
- Modify: `packages/api/src/api/store/alkemart/catalog/route.ts`
- Modify: `packages/api/src/api/store/alkemart/vendors/[slug]/route.ts`
- Modify: `packages/api/src/api/store/featured-products/route.ts`
- Modify: `packages/api/src/api/health/route.ts`

**Context brief:** `GET /store/search` (calls Meilisearch — expensive), `GET /store/alkemart/catalog` (can fall back to OOM-level ALL-offers load), `GET /store/alkemart/vendors/:slug` (fallback loads ALL sellers), and `GET /store/featured-products` (loads ALL products then filters in memory) have zero rate limiting. An attacker can hammer these to degrade or crash the service. The `auth-rate-limit.ts` middleware already exists for auth routes.

**Solution:** Add rate limiting middleware to these routes. Read `middlewares/auth-rate-limit.ts` first to understand the existing pattern (IP + email-based). Create a new `middlewares/rate-limit.ts` middleware that rate-limits by IP only (suitable for public endpoints). Use an in-memory Map<string, { count, resetAt }> structure with 60-second windows.

⚠️ **Railway multi-replica caveat:** An in-memory limiter is per-process. On Railway with multiple replicas, each instance tracks its own counter. An attacker could rotate through replicas by reconnecting. This is acceptable for initial hardening but should be upgraded to Redis-based rate limiting when the Redis client is already available in the project.

**Verification:** `bun run test:unit` passes. Send 61 rapid requests to search — receive 429 on the 61st.

---

## Phase 1: Backend Missing Routes

### Task 1.1: Admin seller detail route

**Files:**
- Create: `packages/api/src/api/admin/sellers/[id]/route.ts`

**Context brief:** The admin dashboard has a `/sellers/$id` page that calls `GET /admin/sellers/:id` — this route does not exist. The only seller-specific admin routes are `POST /admin/sellers/:id/approve` and `POST /admin/sellers/:id/suspend` (which are in `admin/sellers/[id]/approve/route.ts` and `admin/sellers/[id]/suspend/route.ts` respectively). The `[id]/route.ts` file does not exist yet — no conflict with existing files.

**Solution:** Create `GET /admin/sellers/:id` as a new file `admin/sellers/[id]/route.ts` alongside the existing `admin/sellers/[id]/approve/` and `admin/sellers/[id]/suspend/` subdirectories. Returns seller details including: id, name, handle, email, phone, description, status, status_reason, approved_at, created_at, address (address_1, city, country_code, province, postal_code), metadata, member count.

- [ ] **Step 1: Create the route**

```typescript
// packages/api/src/api/admin/sellers/[id]/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Seller id required" })
    return
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "seller",
      fields: [
        "id", "name", "handle", "email", "phone", "description",
        "status", "status_reason", "approved_at", "created_at",
        "address.address_1", "address.city", "address.country_code",
        "address.province", "address.postal_code",
        "metadata", "members.id", "members.name", "members.email",
      ],
      filters: { id: sellerId },
    })
    const sellers = Array.isArray(data) ? data : [data]
    const seller = sellers[0]
    if (!seller) {
      res.status(404).json({ error: "Seller not found" })
      return
    }
    res.status(200).json({ seller })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to load seller",
    })
  }
}
```

- [ ] **Step 2: Verify**

Run: `bun run test:unit` — all tests pass.

- [ ] **Step 3: Commit**

```
git add packages/api/src/api/admin/sellers/
git commit -m "feat(api): add GET /admin/sellers/:id route for seller detail page"
```

### Task 1.2: Admin commission rates CRUD

**Files:**
- Create: `packages/api/src/api/admin/commission-rates/route.ts`
- Create: `packages/api/src/api/admin/commission-rates/[id]/route.ts`

**Context brief:** The admin dashboard has a `/commission-rates` page that calls `GET /admin/commission-rates`, `POST /admin/commission-rates`, `POST /admin/commission-rates/:id`, `DELETE /admin/commission-rates/:id`. None of these routes exist. Commission rates are a Mercur-specific concept.

**Research:** Search for the Mercur commission module:
1. `grep -r "commission" /home/amber/Desktop/amber/Alkemart4/Alkemart4/apps/backend/node_modules/@mercurjs/core/.medusa/server/src/modules/` — find available module exports
2. Check `@mercurjs/core` package.json for module paths
3. Read the module's service to find methods like `listCommissionRates`, `createCommissionRate`, `updateCommissionRate`, `deleteCommissionRate`

**Solution:** Create routes that delegate to the Mercur module service. Pattern:
```typescript
// GET /admin/commission-rates — list with pagination
// POST /admin/commission-rates — create new rate
// DELETE /admin/commission-rates/:id — delete rate
```

Use `req.scope.resolve("commissionModule")` or whatever the module registration key is. The exact module key should be found during research step.

**Verification:** `GET /admin/commission-rates` returns `{ rates: [], count: 0 }` when no rates exist.

### Task 1.3: Admin payouts list and detail

**Files:**
- Create: `packages/api/src/api/admin/payouts/route.ts`
- Create: `packages/api/src/api/admin/payouts/[id]/route.ts`

**Context brief:** The admin dashboard has a `/payouts` page that calls `GET /admin/payouts` and `GET /admin/payouts/:id`. Neither route exists. Payouts are a Mercur-specific concept.

**Solution:** Create list/detail routes using the Mercur payouts module.

**Verification:** `GET /admin/payouts` returns `{ payouts: [], count: 0 }` when no payouts exist.

### Task 1.4: Fix featured-products metadata merge

**Files:**
- Read: `packages/api/src/api/admin/featured-products/route.ts`
- Modify: `packages/api/src/api/admin/featured-products/route.ts`

**Context brief:** `POST /admin/featured-products` calls `productModule.updateProducts(id, { metadata: { featured } })` which **overwrites** all existing metadata with `{ featured: ... }`. This destroys any other metadata the product had (e.g., alkemart moderation data, quality scores).

**Solution:** Merge the `featured` key into existing metadata instead of replacing it. Requires reading the existing product's metadata from the graph query first.

- [ ] **Step 1: Read the route file** — Find the `GET` and `POST` handlers. The `POST` handler currently does a graph query for product fields but does NOT include `metadata` in the queried fields.

- [ ] **Step 2: Add `metadata` to the graph query fields** in the `POST` handler so existing metadata is available:

```typescript
const { data } = await query.graph({
  entity: "product",
  fields: ["id", "title", "status", "metadata", /* ...existing fields */],
  filters: { id: productId },
})
const product = asList(data)[0]
```

- [ ] **Step 3: Change the update call** to spread existing metadata:

Change from:
```typescript
await productModule.updateProducts(productId, { metadata: { featured } })
```
To:
```typescript
await productModule.updateProducts(productId, {
  metadata: { ...(product.metadata as Record<string, unknown> | undefined || {}), featured }
})
```

- [ ] **Step 3: Verify**

```
bun run test:unit — all tests pass
```

- [ ] **Step 4: Commit**

```
git add packages/api/src/api/admin/featured-products/route.ts
git commit -m "fix(api): merge featured metadata instead of overwriting"
```

---

## Phase 2: Backend Performance & Correctness

### Task 2.1: Add pagination to admin seller queue

**Files:**
- Modify: `packages/api/src/api/admin/alkemart/moderation/sellers/route.ts`

**Context brief:** The seller queue endpoint loads ALL sellers then filters in-memory. For 1000+ sellers this becomes slow and memory-intensive. The admin frontend also doesn't pass pagination params.

**Solution:** Add `limit` (default 50, max 200) and `offset` (default 0) query params. Push filtering to the database where possible.

**Verification:** `GET /admin/alkemart/moderation/sellers?limit=10&offset=0` returns at most 10 items.

### Task 2.2: Fix catalog OOM fallback

**Files:**
- Modify: `packages/api/src/api/store/alkemart/catalog/route.ts`

**Context brief:** Lines 132-139: when the nested graph filter query fails, the route fetches ALL offers without filters. On a marketplace with millions of offers, this will OOM the Node process.

**Solution:** Remove the fallback to unbounded fetch. Either return a 503 error or use the two-pass approach with `limit` applied before application-level filtering.

- [ ] **Step 1: Read the route file**, focusing on lines 120-145. Identify the `try-catch` block where the nested filter fails and the fallback loads all offers.
- [ ] **Step 2: Replace the fallback** — Instead of fetching ALL offers in the catch block, either:
  - a) Return a 503 error immediately (safe, but degrades UX)
  - b) Perform an application-level filter but on a bounded set: first fetch offers with a `limit` (max page size, e.g. 200), then filter in memory:
    ```typescript
    // In the catch block, instead of:
    const { data: allOffers } = await query.graph({ entity: "offer", fields: [...] })
    // Use:
    const { data: boundedOffers } = await query.graph({
      entity: "offer",
      fields: [...],
      pagination: { take: 200 }, // bounded — cannot OOM
    })
    ```
- [ ] **Step 3: Verify** — `bun run test:unit` passes

### Task 2.3: Fix vendor-by-slug case-insensitive fallback

**Files:**
- Modify: `packages/api/src/api/store/alkemart/vendors/[slug]/route.ts`

**Context brief:** Lines 55-77: When handle lookup fails (case mismatch), the endpoint loads ALL sellers into memory to scan for case-insensitive matches. For 10,000+ sellers, this is catastrophic.

**Solution:** The graph query API likely supports case-insensitive filtering. First check if Medusa Query Graph supports `ilike` or `LIKE` operator. If it does, use that. If not, simply return 404 (exact-match-only handles) — this is production-safe and standard practice.

- [ ] **Step 1: Read lines 55-77** — Identify the in-memory scan pattern
- [ ] **Step 2: Try case-insensitive query**:
    ```typescript
    // Replace the in-memory scan with:
    const { data: allSellers } = await query.graph({
      entity: "seller",
      fields: [...],
      filters: { handle: { $ilike: slug } }, // if supported
    })
    ```
    Check if `$ilike` or similar operator is supported by reading Medusa Query Graph docs.
- [ ] **Step 3: Fallback** — If case-insensitive filtering is not supported by the query API, simply remove the in-memory scan:
    ```typescript
    // Instead of loading ALL sellers, return 404:
    res.status(404).json({ error: "Seller not found" })
    return
    ```
- [ ] **Step 4: Verify** — `bun run test:unit` passes. Existing non-matching-case requests now get 404 instead of a match.

### Task 2.4: Add pagination to vendor products list

**Files:**
- Modify: `packages/api/src/api/vendor/alkemart/products/route.ts`

**Context brief:** The vendor products list has no pagination. A seller with many products will load them all at once. The frontend (ghana-vendor products page) also has no pagination controls.

**Solution:** Add `limit` and `offset` query params to the backend route. Cache key should include pagination params.

**Verification:** `GET /vendor/alkemart/products?limit=10&offset=0` returns at most 10 items.

### Task 2.5: Fix admin orders filter param name

**Files:**
- Modify: `packages/api/src/api/admin/orders/route.ts`
- Modify: `apps/admin/src/lib/api.ts`

**Context brief:** The admin frontend sends `status[]=pending` as a query param, but the backend route reads `req.query.status` (singular). The `[]` suffix means the backend never receives the filter, so status filtering never works.

**Solution:** Fix the frontend to send `status` (singular). Confirm the backend reads `req.query.status` (singular) — if it reads something else, fix both.

Expected backend behavior (read and verify):
```typescript
// packages/api/src/api/admin/orders/route.ts — read around line 10-15
// Should read: req.query.status or req.query.status[]
// If it reads req.query.status (singular), only frontend needs fixing
// If it reads req.query.status[], fix backend too
```

- [ ] **Step 1: Read backend route** — `packages/api/src/api/admin/orders/route.ts` line 10-15. Confirm what param name the backend reads.
- [ ] **Step 2: Read frontend** — `apps/admin/src/lib/api.ts` line ~204, confirm `status[]` is sent.
- [ ] **Step 3: Fix frontend** — Change `sp.set("status[]", params.status)` to `if (params?.status) sp.set("status", params.status)`
- [ ] **Step 4: Fix backend if needed** — If backend reads `req.query.status`, it already matches. If it reads something else or doesn't exist, add `const statusFilter = req.query.status as string | undefined` and use it in the graph filter.
- [ ] **Step 5: Verify** — `bun run test:unit` passes

---

## Phase 3: Admin Frontend Fixes

### Task 3.1: Fix featured toggle endpoint call

**Files:**
- Read: `apps/admin/src/hooks/use-products.ts`
- Read: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/routes/_authenticated/featured-products.tsx`

**Context brief:** The featured products page toggles via `adminProducts.update(id, { metadata: { featured: "true" } })` which calls `POST /admin/products/:id` (Medusa core). A dedicated `POST /admin/featured-products` endpoint exists with validation and cleaner semantics, but the frontend never uses it. The `api.ts` defines `featuredProducts.toggle` but it's never imported.

**Solution:** Wire the featured products page to use `featuredProducts.toggle` instead of `adminProducts.update`.

### Task 3.2: Wire admin seller detail page

**Files:**
- Read: `apps/admin/src/routes/_authenticated/sellers.$id.tsx`
- Modify: `apps/admin/src/hooks/use-sellers.ts` or inline query

**Context brief:** The seller detail page calls `GET /admin/sellers/:id` (now created in Task 1.1). The hook/query must point to the correct API function. The `api.ts` defines `adminSellers.retrieve` but it's not wired into a hook.

**Solution:** Ensure the seller detail page's data fetching correctly calls the new route.

### Task 3.3: Wire commission rates and payouts pages

**Files:**
- Read: `apps/admin/src/routes/_authenticated/commission-rates.tsx`
- Read: `apps/admin/src/routes/_authenticated/payouts.tsx`
- Modify: `apps/admin/src/lib/api.ts` (add commission/payout API functions
- Create: `apps/admin/src/hooks/use-commission-rates.ts`
- Create: `apps/admin/src/hooks/use-payouts.ts`

**Context brief:** Both pages will 404 because no backend routes exist. After creating routes in Tasks 1.2 and 1.3, wire the frontend to use them.

**Solution:** Create proper hooks that call the new backend routes, matching the expected response shapes.

---

## Phase 4: Vendor Portal Fixes

### Task 4.1: Fix nav active state

**Files:**
- Read: `apps/ghana-vendor/src/components/layout.tsx`
- Modify: `apps/ghana-vendor/src/components/layout.tsx`

**Context brief:** CRITICAL bug. The layout's `isActive` check on lines 50 and 100 compares `router.location.pathname` (which is relative to the basepath `/seller`) against hardcoded paths starting with `/seller`. Since the router strips the basepath, `pathname` is `/`, `/products`, `/orders`, etc. — never `/seller/*`. Nav highlighting is completely broken.

**Solution:** Compare against `item.to` directly (e.g., `pathname === item.to` for exact match, or `pathname.startsWith(item.to)` for prefix match).

- [ ] **Step 1: Read `layout.tsx` lines 45-55 and 95-105**
- [ ] **Step 2: Fix active detection** — The router has `basepath: '/seller'`. TanStack Router strips the basepath from `router.state.location.pathname`, so it is relative (`/`, `/products`, `/orders`, etc.), NOT absolute (`/seller`, `/seller/products`).

Change both desktop and mobile nav to use basepath-relative comparison:

```tsx
// Instead of:
const isActive = item.to === "/"
  ? router.location.pathname === "/seller" || router.location.pathname === "/seller/"
  : router.location.pathname.startsWith(`/seller${item.to}`)

// Use (basepath is already stripped by the router):
const pathname = router.state.location.pathname
const isActive = item.to === "/"
  ? pathname === "/"
  : pathname.startsWith(item.to)
```

Apply this change in two places: desktop sidebar nav (line ~50) and mobile bottom nav (line ~100).

- [ ] **Step 3: Verify manually** — Navigate between pages, check which nav item is highlighted.

### Task 4.2: Fix refund payment ID bug

**Files:**
- Read: `apps/ghana-vendor/src/routes/returns.tsx`
- Modify: `apps/ghana-vendor/src/routes/returns.tsx`
- Modify: `packages/api/src/api/vendor/alkemart/returns/route.ts` (if needed, to add payment_id to return response)

**Context brief:** CRITICAL. Line 189 of `returns.tsx` calls `refund.mutate({ paymentId: ret.id, ... })` where `ret.id` is the **return** ID, not a payment ID. The API endpoint `POST /vendor/payments/:id/refund` expects a payment ID. This refund will always fail with 404.

**Solution:** Add `payment_id` field to the return response from the backend, then use it in the frontend refund call.

- [ ] **Step 1: Read returns route.html backend to see how returns are fetched**
- [ ] **Step 2: Add payment_id to the return response shape**
- [ ] **Step 3: Update frontend to use `payment_id` instead of `id`**

```tsx
// Instead of:
refund.mutate({ paymentId: ret.id, amount: ret.refund_amount! })
// Use:
refund.mutate({ paymentId: ret.payment_id, amount: ret.refund_amount! })
```

### Task 4.3: Fix auth redirect flash

**Files:**
- Modify: `apps/ghana-vendor/src/routes/__root.tsx`

**Context brief:** When unauthenticated, the root component renders a loading spinner for 1-2 round trips before redirecting to `/login`. Creates an ugly flash.

**Solution:** Replace the spinner with an immediate `<Navigate to="/login" />` component in the render path.

- [ ] **Step 1: Read `__root.tsx` lines 30-50**
- [ ] **Step 2: Fix render path**

Change from rendering a spinner to rendering Navigate:
```tsx
if (!isPublicPage && (isError || !user)) {
  return <Navigate to="/login" />
}
```

Import Navigate from `@tanstack/react-router`.

### Task 4.4: Fix `seller.select()` error swallowing

**Files:**
- Modify: `apps/ghana-vendor/src/lib/api.ts`

**Context brief:** Line 863: `await seller.select(sellerId).catch(() => {})` silently swallows any error from the select call. If the backend session fails to bind the seller, the user appears logged in but all subsequent requests fail.

**Solution:** Remove the `.catch()` or at minimum log the error. Let the caller handle failures.

- [ ] **Step 1: Read `api.ts` around the login flow (lines 850-870)**
- [ ] **Step 2: Fix error handling**

```typescript
await seller.select(sellerId)
// Remove .catch(() => {})
```

If the select call fails, the error will propagate to the login mutation, which will catch it and show the user an error message.

### Task 4.5: Fix StatusRow stale mutation state

**Files:**
- Modify: `apps/ghana-vendor/src/routes/settings.tsx`

**Context brief:** Lines 460-480: The `StatusRow` component reads `mutation.isSuccess` and `mutation.isError` directly. TanStack Query mutations retain state indefinitely. If a user saves, navigates away and back, the success/error banner from the previous submission is still visible.

**Solution:** Reset mutation state on component unmount. Use `onMutate` callback to clear previous success/error state when a new mutation starts.

- [ ] **Step 1: Read `settings.tsx` StatusRow component** (lines 460-480)
- [ ] **Step 2: Add mutation reset on submit**

In the `mutation.mutate` call, use `onMutate` to reset state:
```tsx
const mutation = useMutation({
  mutationFn: ...,
  onMutate: () => {
    // Clear previous success/error state before new mutation
  },
  onSuccess: () => { ... },
  onError: () => { ... },
})
```

Also add a cleanup that resets when the component unmounts:
```tsx
// In the component body:
const mutation = useMutation(...)

useEffect(() => {
  return () => { mutation.reset() }
}, []) // empty deps — runs only on unmount; mutation reference is stable in TanStack Query v5
```

### Task 4.6: Add pagination tracking number support

**Files:**
- Modify: `apps/ghana-vendor/src/routes/orders/$id.tsx`

**Context brief:** The shipping form only sends `tracking_number` but the API supports both `tracking_number` and `tracking_url` arrays. Major carriers include tracking URLs for customer convenience.

**Solution:** Add an optional tracking URL field to the shipping form.

---

## Phase 5: Payment & Checkout Hardening

### Task 5.1: Paystack webhook rawBody robustness

**Files:**
- Read: `packages/api/src/api/hooks/paystack/route.ts`
- Modify: `packages/api/src/api/hooks/paystack/route.ts`

**Context brief:** The HMAC signature verification has a fragile fallback chain for rawBody retrieval. If neither `rawBody` nor `buffer` is available on `req`, it falls back to `JSON.stringify(req.body)` which can produce a different string, causing HMAC mismatch and silent webhook rejection.

**Solution:** Add a custom body parser middleware for the Paystack webhook route that ensures `rawBody` is available, or improve the fallback to handle encoding issues.

### Task 5.2: Add payment_id to vendor returns response

**Files:**
- Read: `packages/api/src/api/vendor/alkemart/returns/route.ts`
- Modify: `packages/api/src/api/vendor/alkemart/returns/route.ts`

**Context brief:** The refund flow (Task 4.2) needs `payment_id` in the return response. Currently the return response doesn't include this field.

**Solution:** Query the payment ID from the order's payment collection when building the return response.

---

## Phase 6: Testing & Verification

### Task 6.1: Integration test for seller onboarding flow

**Files:**
- Create: `packages/api/src/lib/__tests__/seller-onboarding.e2e.spec.ts`

**Context brief:** The seller onboarding flow (register as seller member, ghana-setup, readiness evaluation) has no integration test. All fixes in Phases 0-4 depend on this path working correctly.

**Test framework:** Jest (same as existing unit tests at `src/lib/__tests__/*.unit.spec.ts`). Follow the pattern in `seller-readiness.unit.spec.ts` — mock `@medusajs/framework/utils` and `@medusajs/framework/http` as needed.

**Test scenarios:**
1. `runGhanaSellerSetup` with a valid approved seller — verifies stock_location, shipping_profile, shipping_option, and seller.address are all created
2. `evaluateSellerReadiness` after setup — verifies phase is `"active"` and checklist items are all `true`
3. `assertCanSell` with incomplete seller (no address) — verifies it throws/returns false
4. `assertCanSell` with complete seller — verifies it passes

**Mock strategy:** Mock `req.scope.resolve` to return test fixtures. Mock `ContainerRegistrationKeys.QUERY` to return controlled data. Mock `@mercurjs/core/workflows` to capture inputs without running real workflows.

**Verification:** `bun run test:unit` — new tests pass alongside existing 14 suites.

### Task 6.2: Integration test for product moderation flow

**Files:**
- Create: `packages/api/src/lib/__tests__/moderation-flow.e2e.spec.ts`

**Context brief:** The product moderation flow (quick-list → propose → approve → published) has no integration test. Critical path for marketplace functionality.

**Test scenarios (using Jest, same framework as Task 6.1):**
1. Quick-list creates product + variant + offer correctly
2. Propose transitions status from "draft" to "proposed"
3. Approve transitions from "proposed" to "published" + creates offer
4. Reject transitions from "proposed" to "rejected" with reason
5. Request-changes sets metadata without changing status
6. Seller cannot propose if readiness is incomplete

**Verification:** `bun run test:unit` — all tests pass.

### Task 6.3: Production audit final pass

**Files:**
- N/A (run production audit skill)

**Context brief:** After all fixes are applied, run the production audit skill one final time to confirm 85+ score.

---

## Execution Strategy

```
Phase 0 ─── Security (parallel within phase)
  │
  ▼
Phase 1 ─── Missing routes (Task 1.1, 1.2, 1.3 in parallel; 1.4 parallel)
  │
  ▼
Phase 2 ─── Performance (2.1, 2.2, 2.3, 2.4, 2.5 in parallel)
  │
  ▼
Phase 5 ─── Payment hardening (5.2 must finish before Phase 4 Task 4.2)
  │
  ▼
Phase 3 ─── Admin frontend (sequential: 3.2 depends on 1.1, 3.3 depends on 1.2+1.3)
  │
  ▼
Phase 4 ─── Vendor portal (4.1, 4.3, 4.4, 4.5 parallel; 4.2 depends on Phase 5 Task 5.2)
```

Phase 6 (Testing) runs after all tasks in 0-5 are complete.

### Maximum Parallelism

- Day 1: Phase 0 all tasks (3 agents)
- Day 2: Phase 1 all tasks (4 agents, then 1 more for 1.4)
- Day 3: Phase 2 all tasks (5 agents) + Phase 5 (2 agents, since independent)
- Day 4: Phase 3 (up to 3 agents if dependencies resolved) + Phase 4 (up to 5 agents)
- Day 5: Phase 6 (testing pass + audit)

Total: ~5 days sequential, ~2-3 days with maximum parallelism.

---

## Rollback Strategy

Each task is a separate commit. If a task breaks something:
- Revert the specific commit: `git revert <commit-hash>`
- No migration rollbacks needed (no schema changes in this plan)
- Verify with `bun run test:unit` after revert
