# RBAC × workflow production audit — Alkemart

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Verdict** | **NOT production-ready** for buyer trust / guest commerce pen-test |
| **Partial strength** | Three-door actor isolation (customer / member / user) is real on APIs |
| **Tone** | Honest — no theater |

---

## 0. Bottom line

| Area | Score | Reality |
|------|-------|---------|
| Seller ↛ Admin | **Strong** | Wrong actor → 401 (e2e covers) |
| Buyer ↛ Vendor | **Strong** | Member JWT required |
| Admin moderation read | **OK** | `authenticate("user")` |
| Seller readiness / propose gates | **Partial** | Soft gates + env kill-switch |
| Buyer SPA “RBAC” | **Theater** | Binary guest/customer + redirects |
| Guest COD → track order | **Broken** | Product contract vs code conflict |
| Checkout ↔ account bind | **Broken** | JWT ignored by Ghana checkout |
| Customer `metadata.roles` | **Time bomb** | Writable; unused for real auth |
| Docs (`customer_role` / CASL) | **Lies** | Archive stack / fantasy SoT |
| Ready for production testing sign-off | **No** | Fix P0–P1 first |

**What people mean by “we’re joking”:** docs and UI *talk* multi-role RBAC while enforcement is either (a) Medusa/Mercur actor types, or (b) SPA redirects that an API client walks around — plus guest order UX that forces login after promising guest lookup.

---

## 1. Real enforcement model (three doors)

```
┌──────────────┐   customer JWT / guest+PK    ┌─────────────────┐
│  Buyer SPA   │ ───────────────────────────► │  /store/*       │
│  :5175       │   offer_id cart · COD        │  Medusa store   │
└──────────────┘                              └─────────────────┘

┌──────────────┐   member JWT + x-seller-id   ┌─────────────────┐
│ Seller Hub   │ ───────────────────────────► │  /vendor/*      │
│  :9000/seller│                              │  Mercur ensure  │
└──────────────┘                              │  Seller         │
                                              └─────────────────┘

┌──────────────┐   user JWT / admin api-key   ┌─────────────────┐
│ Admin Panel  │ ───────────────────────────► │  /admin/*       │
│ :9000/dashboard                             │  Medusa user    │
└──────────────┘                              └─────────────────┘
```

**There is no shared CASL matrix in the live monorepo.**  
`@workspace/abilities` / Express roles live under `archive/`.  
Buyer SPA must **not** re-implement staff RBAC (correct product decision).

---

## 2. Workflow matrix (atomic)

Legend: **OK** real gate · **UX** SPA only · **GAP** fail production test · **N/A**

### 2.1 Guest browse → cart → COD

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Browse / search / PDP | Public | PK public | OK |
| ATC | offer_id | Real | OK |
| Cart mutate | Guest | `cart_id` in localStorage = capability | GAP (by design, needs rate limit) |
| Checkout | Guest COD | No JWT required | OK product / GAP security |
| Order confirmation | Guest sees order | `/order/$id` unguarded | GAP (IDOR or 401 unknown) |
| Track later | Guest lookup | **`/orders` requires auth** | **CRITICAL GAP** |

### 2.2 Signed-in buyer account

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Login | Customer JWT | localStorage `medusa_auth_token` | GAP (XSS = full account) |
| Account | Auth | `requireAuth` + customer APIs | OK |
| Addresses | Auth | Customer API | OK |
| Order list | Own orders only | `order.list` with JWT | OK if bind works |
| Guest cart after login | Merge | `transferCart` likely **dead** | **CRITICAL GAP** |
| Checkout while signed in | Order on account | Ghana checkout **ignores** `auth_context` | **CRITICAL GAP** |

### 2.3 Seller lifecycle

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Member register | Seller hub | Mercur | OK |
| Create seller | pending_approval | Mercur | OK |
| Admin approve | open | Mercur admin | OK |
| Incomplete setup propose | DENY | Soft gate + **env kill-switch** | GAP |
| Propose product | Own seller only | ensureSeller + ownership check | OK |
| Create offer | open + setup | Soft gate | OK |
| Seller A → seller B product | DENY | Mercur membership | OK |
| Seller → admin API | DENY | Wrong actor | OK (e2e) |

### 2.4 Admin moderation

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Read queues | Admin only | `user` auth | OK |
| Approve/reject | Admin only | **Mercur** routes, not Alkemart | OK if panels used |
| Reindex search | Admin only | `/admin` default | OK (flat — any admin) |
| Support vs super-admin | Split | **All users equal** | GAP |
| Lab passwords in prod | Refuse | env checks help | Watch deploy |

### 2.5 Cross-actor (must pass for “RBAC live”)

| Attempt | Expected | Covered by e2e? |
|---------|----------|-----------------|
| Buyer JWT → `/vendor/alkemart/onboarding/status` | 401 | Yes |
| Seller JWT → `/admin/alkemart/moderation/*` | 401 | Yes |
| Guest → `/store/alkemart/me` | 401 | Middleware yes |
| Guest → catalog | 200 | Smoke |

---

## 3. CRITICAL blockers (production testing will fail)

### C1 — Guest order UX vs `requireAuth` on `/orders`

- **Docs:** guest may look up order by id (ACCESS-AND-RBAC).
- **Code:** `/orders` `beforeLoad` → `requireAuth` → signin redirect.
- **Sign-in page** links “Find a guest order” → `/orders` → **auth wall**.
- **Fix:** public `/orders/lookup` (or unguarded section); keep list auth-only.

### C2 — Order retrieve authorization undefined

- SPA loads full PII (`shipping_address.*`, email) with only order id + PK.
- Either open **IDOR** or guest confirmation **breaks**.
- **Fix:** server policy: owner JWT **or** email+id **or** short-lived secret query token.

### C3 — Checkout does not bind customer

- `POST /store/ghana-checkout` never reads `auth_context.actor_id`.
- Cart transfer on login uses non-existent `transferCart` → dead.
- **Result:** signed-in buyers’ orders often **never appear** under My Orders.
- **Fix:** attach cart customer via Medusa cart customer endpoint before complete; checkout prefers JWT when present.

### C4 — Cart_id / status = unauthenticated capability

- Expected for guest COD; **no** ownership check, **no** app-level rate limit.
- **Fix:** rate limit status; optional secret on confirmation URL.

### C5 — Customer metadata.roles is untrusted theater

- `/store/alkemart/me` returns `metadata.roles` (buyer can write metadata via Medusa store update).
- Does **not** open admin today — but is a **future escalation bomb** and confuses audits.
- **Docs** claim `customer_role` module — **does not exist**.
- **Fix:** ignore/strip roles on store update; `/me` always returns `[{role:"buyer"}]` until real module.

### C6 — Soft-gate kill-switches

- `ALKEMART_STRICT_PROPOSE_GATES=false` → incomplete sellers can propose.
- `PAYSTACK_WEBHOOK_RELAXED=true` → unsigned webhook accept path.
- **Fix:** refuse boot in production if set.

---

## 4. HIGH risks

| # | Risk | Evidence |
|---|------|----------|
| H1 | JWT in localStorage | Medusa SDK default |
| H2 | Dual propose paths (workflow vs `updateProducts`) | propose route |
| H3 | Offer update gate fail-open without seller_id | validate-offer-update |
| H4 | Category not required on propose (default) | product-quality |
| H5 | Stale CASL / customer_role docs | 2026-07-16-alkemart-rbac.md |
| H6 | Flat admin power (reindex + GMV + queues) | any admin user |
| H7 | Password reset missing on storefront | — |
| H8 | MoMo status open by cart_id | status route |

---

## 5. What is **not** a joke (keep)

1. **Three-door architecture** — buyer SPA never embeds seller/admin dashboards.  
2. **Mercur `ensureSeller`** — `x-seller-id` membership enforced.  
3. **ATC = offer_id** — money path not invented in SPA.  
4. **Seller readiness pure functions** — unit-testable gates.  
5. **Live e2e actor isolation** — `e2e/tests/rbac-multivendor.live.spec.ts`.  
6. **Publishable key + env production rejects** for trivial secrets.

---

## 6. Workflow readiness scorecard (for QA)

| Workflow | Can run lab demo? | Production pen-test ready? |
|----------|-------------------|----------------------------|
| Browse / search | Yes | Yes (public) |
| ATC + cart | Yes | Weak (cart_id) |
| Guest COD place order | Yes (Mode B) | Weak |
| Guest track order | **No** (UX wall) | **No** |
| Account orders | Flaky | **No** until bind |
| Seller onboarding → approve → sell | Lab scripts help | Needs strict env |
| Admin moderate | Yes if panels up | Flat RBAC OK for v1 |
| Cross-actor isolation | Yes | Yes |

---

## 7. Fix plan (ordered for production-ready **testing**)

### P0 — this week (unblock honest tests)

| # | Work | Owner |
|---|------|--------|
| 1 | Split guest order lookup from `requireAuth` | Storefront |
| 2 | Sanitize `/store/alkemart/me` roles; block `metadata.roles` on customer update | Backend |
| 3 | Rewrite stale `2026-07-16-alkemart-rbac.md` → pointer to this doc + ops-rbac | Docs |
| 4 | Production env refuse: `STRICT_PROPOSE_GATES=false`, `PAYSTACK_WEBHOOK_RELAXED=true` | Backend env |
| 5 | E2E: guest place → open `/order/:id`; guest open `/orders/lookup` without login | e2e |

### P1 — buyer integrity

| # | Work |
|---|------|
| 6 | Cart attach customer on login (real Medusa API) |
| 7 | Ghana checkout bind customer when JWT present |
| 8 | Order retrieve policy (secret or owner) + e2e IDOR matrix |
| 9 | Rate-limit checkout status |

### P2 — seller gates solid

| # | Work |
|---|------|
| 10 | Fail-closed offer update without seller_id |
| 11 | Unify propose path with create-proposed gates |
| 12 | `REQUIRE_CATEGORY_ON_PROPOSE=true` after seed |
| 13 | E2E: cross-seller propose DENY |

### P3 — ops hardening

| # | Work |
|---|------|
| 14 | Explicit middleware on all `/admin/alkemart/*` + reindex POST |
| 15 | Audit log reindex; consider ops role later |
| 16 | Session cookies for buyer (optional, XSS surface) |

---

## 8. Production test script (minimum sign-off)

```text
[ ] Guest: browse → ATC → COD → confirmation page shows order id
[ ] Guest: open /orders/lookup (or public find) with id → detail (no login)
[ ] Guest: other random order id → 403/404 (not full PII)
[ ] Buyer login: cart survives or merge works
[ ] Buyer checkout: order appears in /orders list
[ ] Buyer JWT → vendor onboarding → 401
[ ] Seller JWT → admin moderation → 401
[ ] Pending seller → propose product → 403
[ ] Active seller → propose own → 200/ok path
[ ] Seller A product id + Seller B context → 403
[ ] Admin approve seller + confirm product → appears catalog
[ ] metadata.roles forged → still cannot hit /admin
[ ] STRICT_PROPOSE_GATES=false refused in NODE_ENV=production
```

---

## 9. Evidence index

| Area | Path |
|------|------|
| SPA guards | `apps/storefront/src/lib/route-guards.ts`, `routes/orders.tsx`, `account.tsx` |
| SPA auth | `apps/storefront/src/lib/auth.ts` |
| Buyer access doc | `apps/storefront/docs/ACCESS-AND-RBAC.md` |
| Middleware | `apps/backend/packages/api/src/api/middlewares.ts` |
| Me roles | `.../store/alkemart/me/route.ts` |
| Checkout | `.../store/ghana-checkout/route.ts`, `lib/ghana-checkout.ts` |
| Readiness | `lib/seller-readiness.ts` |
| Propose | `vendor/alkemart/products/[id]/propose/route.ts` |
| Live e2e | `e2e/tests/rbac-multivendor.live.spec.ts` |
| Stale doc | `docs/architecture/2026-07-16-alkemart-rbac.md` |
| Ops intent | `docs/architecture/2026-07-16-ops-rbac-surfaces.md` |

---

## 10. Implementation log (same day)

- [x] This audit locked  
- [x] Guest order lookup route (no auth wall)  
- [x] `/store/alkemart/me` roles always buyer (ignore metadata.roles)  
- [x] Stale RBAC doc rewritten to honest pointer  
- [x] ACCESS-AND-RBAC updated with production blockers  

## 11. Per-workflow execution plans + screenshots

**`docs/architecture/workflow-plans-2026-07-19/`**

- Master index + W01–W15 atomic plans  
- Live screenshots under `screens/`  
- Reevaluation gates + over/under-engineering notes  
