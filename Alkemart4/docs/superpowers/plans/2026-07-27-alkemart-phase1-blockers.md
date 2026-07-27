# Phase 1: BLOCKER Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 18 BLOCKER issues across backend API, payments, vendor SPA, admin SPA, workflows, and deploy config

**Architecture:** Each fix is independent and self-contained. Tasks grouped by area for logical ordering. Fixes touch backend API routes, frontend SPA lib files, workflow/lib files, and deploy config.

**Tech Stack:** Medusa v2.17.2, React 19 + TanStack Router, Vite, Railway, Paystack, Redis, MeiliSearch

**Global Constraints:**
- Do not add new features or change architecture
- Follow existing code style and patterns in each file
- No breaking changes to API contracts
- All JWT localStorage removals must keep session cookies working
- Test each fix with `bun run build` before committing

---

### Task 1: Fix DELETE product — `product` undefined ReferenceError

**Files:**
- Modify: `apps/backend/packages/api/src/api/vendor/alkemart/products/[id]/route.ts:246-261`

**Interfaces:**
- Consumes: `query.graph` with entity `"product"`, fields `["id", "variants.id"]`
- Produces: Correctly fetches product variants before offer cleanup

- [ ] **Read the current DELETE handler**

Read `vendor/alkemart/products/[id]/route.ts` to understand the DELETE flow.

- [ ] **Fix product fetch before offer cleanup**

Replace the dead `product` reference with a proper product fetch:
```typescript
// Before offer cleanup, fetch product with variants
const { data: productDetail } = await query.graph({
  entity: "product",
  fields: ["id", "variants.id"],
  filters: { id: productId },
})
const prodList = asList(productDetail) as Array<Record<string, unknown>>
const deleteProduct = prodList[0]
const productVariants = (deleteProduct?.variants ?? []) as Array<{ id: string }>
```

- [ ] **Change offer query to filter by product_id**

Replace `filters: { seller_id: sid }` with `filters: { product_id: productId }`:
```typescript
const { data: offerData } = await query.graph({
  entity: "offer",
  fields: ["id", "variant_id"],
  filters: { product_id: productId },
})
```

- [ ] **Update the variant matching logic**

Replace the existing variant matching to use `deleteProduct`:
```typescript
const variantIds = new Set(productVariants.map((v) => v.id))
const offersToDelete = asList(offerData).filter(
  (o: Record<string, unknown>) => variantIds.has(String(o.variant_id ?? "")),
)
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/api/vendor/alkemart/products/\[id\]/route.ts
git commit -m "fix: ReferenceError in DELETE product — fetch variants before offer cleanup, filter offers by product_id"
```

---

### Task 2: Fix Paystack HTTP calls — add timeouts

**Files:**
- Modify: `apps/backend/packages/api/src/lib/paystack-client.ts:100-110`

**Interfaces:**
- Consumes: Native `fetch` calls in `paystackRequest`
- Produces: All Paystack API calls timeout after 10s

- [ ] **Read paystack-client.ts**

Read `paystack-client.ts` to understand the fetch call.

- [ ] **Add timeout to paystackRequest**

Add `AbortSignal.timeout(10000)` to the fetch call:
```typescript
const res = await fetch(url, {
  ...init,
  signal: AbortSignal.timeout(10000),
})
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/paystack-client.ts
git commit -m "fix: add 10s timeout to all Paystack HTTP calls"
```

---

### Task 3: Fix mergeCartMetadata race condition

**Files:**
- Modify: `apps/backend/packages/api/src/lib/ghana-checkout.ts:286-299`

**Interfaces:**
- Consumes: `mergeCartMetadata(container, cartId, patch)`
- Produces: Atomic metadata merge without read-modify-write race

- [ ] **Read ghana-checkout.ts mergeCartMetadata function**

Read the function and understand the race condition.

- [ ] **Replace with atomic metadata update**

Replace the read-modify-write with a direct update using the cart module:
```typescript
async function mergeCartMetadata(container, cartId, patch) {
  const cartModule = container.resolve(Modules.CART)
  // Use Medusa's update which internally merges metadata
  await cartModule.updateCarts([{ id: cartId, metadata: patch }])
}
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/ghana-checkout.ts
git commit -m "fix: atomic mergeCartMetadata — use direct update instead of read-modify-write"
```

---

### Task 4: Fix crash-unsafe order creation ordering

**Files:**
- Modify: `apps/backend/packages/api/src/lib/ghana-checkout.ts:460-501`

**Interfaces:**
- Consumes: `ensureSystemPaymentAndCompleteCart`, `mergeCartMetadata`
- Produces: Metadata written before order completion, crash-safe

- [ ] **Read the confirmMomoByPaystackReference flow**

Understand the order creation and metadata write ordering.

- [ ] **Swap order: write metadata first, then complete cart**

Move metadata write before `ensureSystemPaymentAndCompleteCart`:
```typescript
// Write metadata first
await mergeCartMetadata(container, cartId, {
  ghana_payment: "momo",
  paystack_reference: reference,
  ghana_payment_status: "succeeded",
})
// Then complete cart
const { order_id } = await ensureSystemPaymentAndCompleteCart(container, cartId)
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/ghana-checkout.ts
git commit -m "fix: write metadata before order completion to prevent orphan orders on crash"
```

---

### Task 5: Remove JWT from localStorage — Vendor SPA

**Files:**
- Modify: `apps/backend/apps/ghana-vendor/src/lib/api.ts`

**Interfaces:**
- Consumes: `getAuthToken()`, `setAuthToken()`, `TOKEN_KEY` — all removed
- Produces: `apiFetch` no longer sends `Authorization: Bearer` header

- [ ] **Read vendor SPA api.ts**

Read the full file to understand all JWT usage.

- [ ] **Remove token management functions**

Delete `TOKEN_KEY`, `getAuthToken()`, `setAuthToken()`.

- [ ] **Remove Authorization header from apiFetch**

Remove the `Authorization: Bearer` header injection in `apiFetch`. Only keep `credentials: "include"`.

- [ ] **Remove Authorization header from upload**

In the `upload` function, remove the `Authorization` header construction. Only keep `x-seller-id`.

- [ ] **Remove token references in loginAndSelectSeller**

Remove `setAuthToken(token)` call. Session cookie is set by the backend response.

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/apps/ghana-vendor/src/lib/api.ts
git commit -m "fix: remove JWT from localStorage — use httpOnly session cookie only"
```

---

### Task 6: Fix createObjectURL memory leak — Vendor SPA

**Files:**
- Modify: `apps/backend/apps/ghana-vendor/src/routes/quick-sell.tsx`

- [ ] **Read quick-sell.tsx**

Read the file, find the `handleFileChange` function.

- [ ] **Add URL.revokeObjectURL on cleanup and before new URL**

```typescript
useEffect(() => {
  return () => { if (preview) URL.revokeObjectURL(preview) }
}, [preview])

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const selected = e.target.files?.[0]
  if (selected) {
    if (preview) URL.revokeObjectURL(preview)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setStep(2)
  }
}
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/apps/ghana-vendor/src/routes/quick-sell.tsx
git commit -m "fix: revoke createObjectURL in quick-sell to prevent memory leak"
```

---

### Task 7: Add admin role check — Admin SPA

**Files:**
- Modify: `apps/backend/apps/admin/src/lib/api.ts` (add role to AuthUser)
- Modify: `apps/backend/apps/admin/src/routes/_authenticated.tsx` (add role check)

- [ ] **Read admin SPA auth files**

Read `api.ts` and `_authenticated.tsx`.

- [ ] **Add role field to AuthUser type**

```typescript
export type AuthUser = {
  id: string
  email: string
  role?: string
}
```

- [ ] **Add role check in beforeLoad**

```typescript
if (!session?.user?.role || session.user.role !== "admin") {
  throw new Error("Unauthorized — admin access required")
}
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/apps/admin/src/lib/api.ts apps/backend/apps/admin/src/routes/_authenticated.tsx
git commit -m "fix: add admin role check in auth guard"
```

---

### Task 8: Remove JWT from localStorage — Admin SPA

**Files:**
- Modify: `apps/backend/apps/admin/src/lib/api.ts`

- [ ] **Read admin SPA api.ts**

Read the full file.

- [ ] **Remove token management**

Delete `TOKEN_KEY`, `getToken()`, `setToken()`.

- [ ] **Remove Authorization header**

Remove `Authorization: Bearer` from `apiFetch`.

- [ ] **Remove setToken from login/logout**

Keep only session cookie flow.

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/apps/admin/src/lib/api.ts
git commit -m "fix: remove JWT from localStorage in admin SPA"
```

---

### Task 9: Fix catalog-map null prices

**Files:**
- Modify: `apps/backend/packages/api/src/lib/catalog-map.ts:67-88`

- [ ] **Read catalog-map.ts minPriceFromOfferPrices**

Find the function and understand the price fallback.

- [ ] **Fix price fallback logic**

```typescript
const amount = p.amount != null ? num(p.amount) : (p.calculated_amount != null ? num(p.calculated_amount) : null)
if (amount == null) logger.warn("[catalog] offer has no amount or calculated_amount", p.id)
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/catalog-map.ts
git commit -m "fix: handle null amounts in catalog price mapping"
```

---

### Task 10: Fix completeCartWorkflow throwOnError

**Files:**
- Modify: `apps/backend/packages/api/src/lib/ghana-checkout.ts:340-357`

- [ ] **Read the completeCartWorkflow call**

Find the `throwOnError: false` usage.

- [ ] **Change to throwOnError: true**

```typescript
const { result } = await completeCartWorkflow(container).run({
  input: { id: cartId },
})
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/ghana-checkout.ts
git commit -m "fix: use throwOnError:true in completeCartWorkflow to prevent ghost orders"
```

---

### Task 11: Fix reset-demo-seller-password email

**Files:**
- Modify: `apps/backend/packages/api/src/scripts/reset-demo-seller-password.ts:8`

- [ ] **Read the script**

- [ ] **Change email constant**

```typescript
const EMAIL = "seller@alkemart.local"
```

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/scripts/reset-demo-seller-password.ts
git commit -m "fix: use correct email in reset-demo-seller-password script"
```

---

### Task 12: Add PAYSTACK_WEBHOOK_RELAXED to Zod schema

**Files:**
- Modify: `apps/backend/packages/api/src/lib/env.ts:131-135`

- [ ] **Read env.ts**

Find the Zod schema and the `PAYSTACK_WEBHOOK_RELAXED` check.

- [ ] **Add to Zod schema**

```typescript
PAYSTACK_WEBHOOK_RELAXED: z.enum(["true", "false"]).optional(),
```

Replace raw `process.env.PAYSTACK_WEBHOOK_RELAXED` check with `parsed.data.PAYSTACK_WEBHOOK_RELAXED`.

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/env.ts
git commit -m "fix: add PAYSTACK_WEBHOOK_RELAXED to Zod validation schema"
```

---

### Task 13: Remove global dns.lookup monkey-patch

**Files:**
- Modify: `apps/backend/packages/api/src/lib/force-ipv4-dns.ts`

- [ ] **Read force-ipv4-dns.ts**

- [ ] **Replace with Node.js native API**

```typescript
import { setDefaultResultOrder } from "dns"
setDefaultResultOrder("ipv4first")
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/lib/force-ipv4-dns.ts
git commit -m "fix: replace dns.lookup monkey-patch with setDefaultResultOrder"
```

---

### Task 14: Create /health endpoint

**Files:**
- Create: `apps/backend/packages/api/src/api/health/route.ts`

- [ ] **Create health route**

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
}
```

- [ ] **Verify the fix compiles**

Run: `cd apps/backend && bun run build`
Expected: Build succeeds

- [ ] **Commit**

```bash
git add apps/backend/packages/api/src/api/health/route.ts
git commit -m "feat: add /health endpoint for Railway health checks"
```

---

### Task 15: Fix Dockerfile bun.lockb reference

**Files:**
- Modify: `apps/backend/packages/api/Dockerfile`

- [ ] **Read Dockerfile**

- [ ] **Change bun.lockb to bun.lock**

Replace all occurrences of `bun.lockb` with `bun.lock`.

- [ ] **Commit**

```bash
git add apps/backend/packages/api/Dockerfile
git commit -m "fix: update Dockerfile to use bun.lock instead of bun.lockb"
```

---

### Task 16: Remove live secrets from .env

**Files:**
- Modify: `apps/backend/packages/api/.env`

- [ ] **Read .env file**

Note all secrets present.

- [ ] **Replace with template values**

Replace all live secrets with placeholder values matching `.env.template` format. Inform the user to rotate the actual secrets.

- [ ] **Commit**

```bash
git add apps/backend/packages/api/.env
git commit -m "chore: replace live secrets with template values"
```
