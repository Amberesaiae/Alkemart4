# ADR: Unclog architecture — stop dual-home Medusa SPA

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | **Accepted** — product feedback: “still the old medusa clogged architecture” |
| **Parent** | Clean-slate backend ADR (`2026-07-16-clean-slate-backend.md`) |

---

## Problem

Clean-slate **API** moved to Mercur, but the **SPA still carried the old dual-home**:

| Clog | Symptom |
|------|---------|
| SPA `/admin/*` + `/vendor/*` | Full ops UIs on buyer app + `api-stubs.ts` (~700 lines) |
| `VITE_OPS_BACKEND=medusa` + `VITE_FEATURE_MEDUSA_RBAC` | Re-enabled SPA admin after cutover |
| Custom half-routes on “clean” backend | `ghana-checkout`, dual worktrees, Express-era habits |
| Buyer + seller + admin in one Vite app | Same “clogged Medusa migration” feeling |

That is **not** clean-slate. That is dual-home with a new logo.

---

## Decision

```text
┌─────────────────────┐     store API only      ┌──────────────────────────┐
│  artifacts/alkemart │ ──────────────────────► │  apps/backend (Mercur)   │
│  BUYER SPA only     │                         │  :9000                   │
│  browse cart checkout│                         │  + /dashboard  ADMIN    │
│  account orders     │                         │  + /seller     VENDOR    │
└─────────────────────┘                         └──────────────────────────┘
         │
         └── Sell / Admin links → external Mercur URLs (not SPA routes)
```

### Hard rules

1. **SPA does not implement marketplace ops.** No inbox, promotions CMS, vendor analytics, disputes inside buyer app for production.
2. **`VITE_OPS_BACKEND` is ignored for enabling SPA ops.** Only `VITE_FEATURE_ADMIN_PORTAL=true` / `VITE_FEATURE_VENDOR_PORTAL=true` re-open emergency shells.
3. **Visiting `/admin` or `/vendor` redirects to Mercur** by default.
4. **Alkemart-owned backend code is thin adapters only** (Paystack, Ghana checkout contract, RBAC extras) — not a second admin framework.
5. **Single runtime API worktree** preferred: develop from `/home/amber/alkemart-backend` (Linux); sync from `apps/backend` deliberately.

### What stays in SPA

- Home, browse, PDP, cart, checkout, orders, account, help, storefront `/store/$slug`
- Medusa JS SDK: products, cart, **offer_id** lines, customer session
- Ghana UX (MoMo-first payment selector, GHS, delivery honesty)

### What leaves SPA (Mercur)

- Seller catalog, inventory, offers, fulfillments  
- Platform sellers, regions, commissions, product approve  
- Any “admin homepage CMS” that still points at Express stubs  

---

## Ghana checkout adapter (not dual-home)

`POST /store/ghana-checkout` is an **Alkemart store adapter** on the Mercur app:

- **COD** → Medusa system payment + `completeCartWorkflow`  
- **MoMo** → honest 503 until Paystack path is complete  

It is **not** Express and not SPA ops. It is the commercial-spine payment entry for the buyer SPA. Prefer one adapter over re-implementing Paystack MoMo inside the SPA.

---

## Migration checklist

- [x] Default ops OFF in `platform-features.ts`
- [x] `/admin` + `/vendor` redirect to Mercur
- [x] SPA `.env`: `VITE_OPS_BACKEND=off`, Mercur URLs on `:9000`
- [x] Hard-delete SPA admin/vendor route files + shells (buyer routes only)
- [x] Slim `api-stubs.ts` / `api-extra.ts` to buyer-only leftovers; drop admin/vendor hooks
- [x] Mercur seller-keyed shipping flatten in `hooks-checkout` + attach in `prepareCartForCheckout`
- [ ] Paystack MoMo full path as sole payment adapter (not dual checkout engines)
- [ ] One worktree workflow doc for backend (no silent /mnt/c vs /home drift)
- [ ] Port remaining buyer Express stubs (support, password, order cancel) to Medusa store routes

---

## Success criterion

A new engineer can answer in one sentence:

> **Buyers use the SPA. Sellers and admins use Mercur. Medusa is the engine, not a second SPA.**

If SPA still has working dual-home ops without an emergency flag, the architecture is still clogged.
