# Alkemart4 — Production Readiness Fixes

**Date:** 2026-07-27
**Context:** Full production-readiness audit found 150 issues (18 BLOCKER, 38 HIGH, 51 MEDIUM, 43 LOW). This spec covers Phase 1: all BLOCKER fixes.

## Areas Covered

1. Backend API routes (DELETE product)
2. Payments/Webhooks (Paystack)
3. Vendor SPA (ghana-vendor)
4. Admin SPA
5. Workflows / Lib / Modules
6. Deploy / Config / Infrastructure

## Design Decisions

### 1. Backend API — DELETE product fix

**Problem:** `vendor/alkemart/products/[id]/route.ts` DELETE handler references undefined `product` variable (ReferenceError). Offer cleanup query filters by `seller_id` instead of `product_id`.

**Fix:** 
- Fetch product with variants before cleanup
- Query offers by `product_id` not `seller_id`
- Make `link.dismiss` failure not block deletion (but log)

### 2. Payments — Paystack HTTP timeouts

**Problem:** All Paystack API calls (`paystackRequest`) use native `fetch` with no timeout. Can hang indefinitely.

**Fix:** Add `AbortSignal.timeout(10000)` to all Paystack fetches. Throw typed error on timeout.

### 3. Payments — `mergeCartMetadata` race condition

**Problem:** Read-modify-write pattern without locking. Concurrent calls lose metadata updates (paystack_reference, ghana_payment_status).

**Fix:** Use atomic metadata merge via Medusa cart module capabilities, or add Redis-based locking keyed on `cart-lock:{cartId}`.

### 4. Payments — Crash-unsafe order creation

**Problem:** `ensureSystemPaymentAndCompleteCart` creates order, then metadata is written separately. Crash between leaves orphan order.

**Fix:** Move metadata update (ghana_order_id, ghana_payment_status) into the same workflow before completion, or add crash recovery.

### 5. Vendor SPA — Remove JWT from localStorage

**Problem:** JWT stored in `localStorage` accessible to any JS on the origin. Backend already supports session cookies (httpOnly).

**Fix:** 
- Delete `TOKEN_KEY`, `setAuthToken`, `getAuthToken` from `lib/api.ts`
- Remove `Authorization: Bearer` header injection
- Rely on `credentials: "include"` session cookie only
- Remove the same pattern from admin SPA

### 6. Vendor SPA — `createObjectURL` memory leak

**Problem:** `URL.createObjectURL` called on file select but never revoked.

**Fix:** Revoke previous blob URL before creating new one. Clean up on unmount via useEffect.

### 7. Admin SPA — Admin role check missing

**Problem:** Auth guard only checks any session exists, not admin role.

**Fix:** Add `role` field to `AuthUser` type. Guard `beforeLoad` checks `user.role === "admin"`. Backend already enforces via `authenticate("user")` on admin routes.

### 8. Workflows — `catalog-map.ts` null prices

**Problem:** `p.amount ?? p.calculated_amount` returns null when neither present.

**Fix:** Check `p.amount` first, fallback to `p.calculated_amount`, log when neither.

### 9. Workflows — `completeCartWorkflow` throwOnError:false

**Problem:** Partial workflow failures still return a result, potentially creating ghost orders.

**Fix:** Use `throwOnError: true` (default). Catch expected errors explicitly.

### 10. Workflows — `reset-demo-seller-password` wrong email

**Problem:** Uses `seller@mercur.dev` instead of `seller@alkemart.local`.

**Fix:** Change to `SELLER_EMAIL = "seller@alkemart.local"`.

### 11. Workflows — `PAYSTACK_WEBHOOK_RELAXED` validation bypass

**Problem:** Env var checked from raw `process.env`, not in Zod schema.

**Fix:** Add to Zod schema: `z.enum(["true", "false"]).optional()`.

### 12. Workflows — Global `dns.lookup` monkey-patch

**Problem:** `force-ipv4-dns.ts` overrides `dns.lookup` globally, breaking IPv6.

**Fix:** Use Node's `dns.setDefaultResultOrder("ipv4first")` instead. Remove the monkey-patch.

### 13. Deploy — No `/health` endpoint

**Problem:** Railway healthcheck path `/health` returns 404.

**Fix:** Create `src/api/health/route.ts` returning `{ status: "ok", timestamp }`.

### 14. Deploy — Dockerfile `bun.lockb`

**Problem:** References `bun.lockb` but project uses `bun.lock`.

**Fix:** Change `bun.lockb` → `bun.lock` in Dockerfile.

### 15. Deploy — Live secrets on disk

**Problem:** `.env` file contains live production credentials.

**Fix:** Rotate all secrets. Remove `.env` from disk. Add to `.gitignore` explicitly. Document using password manager.

## Non-goals

- Not rewriting architecture or changing frameworks
- Not adding new features
- Not addressing every MEDIUM/LOW (deferred to Phase 2+3)

## Success Criteria

- DELETE product works without ReferenceError and cleans up offers
- Paystack calls time out after 10s instead of hanging
- No concurrent metadata loss on payment confirmation
- No JWT in localStorage (both SPAs)
- Admin route accessible only by admin users
- `/health` returns 200
- Dockerfile builds on Railway
- Demo seller script works
