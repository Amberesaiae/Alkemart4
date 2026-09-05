# Ops RBAC surfaces (seller + admin)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-16 |
| **Status** | Plan + wiring — **do not rebuild in buyer SPA** |
| **Decision** | Mercur Admin + Vendor panels are the RBAC UIs |

## Principle

| Surface | App | Auth actor | URL (local) |
|---------|-----|------------|-------------|
| Buyer (guest/customer) | `apps/storefront` | `customer` | `:5175` |
| Seller | Mercur Vendor | `member` + `x-seller-id` | `:9000/seller` |
| Platform admin | Mercur Admin | `user` | `:9000/dashboard` |

Re-implementing seller/admin screens inside the buyer SPA recreates the dual-home failure mode. Ops UIs already ship with Mercur under `apps/backend/apps/{admin,vendor}`.

## What is already implemented (Mercur)

### Seller (`/seller`)

| Workflow | Where |
|----------|--------|
| Member register / login | Vendor panel + `/auth/member/emailpass` |
| Create seller (pending_approval) | Vendor onboarding / `POST /vendor/sellers` |
| Products (draft/proposed) | Vendor catalog |
| Stock locations + sales channel link | Vendor stock |
| Shipping options | Vendor shipping |
| Offers / inventory | Vendor offers |
| Orders / fulfill | Vendor orders |

Runbook: `docs/architecture/2026-07-16-mercur-vendor-rbac-catalog-runbook.md`

### Admin (`/dashboard`)

| Workflow | Where |
|----------|--------|
| User invite / admin auth | Admin auth |
| Approve sellers | Admin sellers |
| Confirm product requests | Admin products |
| Regions, GHS, sales channels | Medusa settings |
| Marketplace rules / commissions | Mercur admin modules |

## Buyer SPA responsibility (only)

1. **Guest + customer** commerce (catalog, cart, COD, account).
2. **Honest deep links** to Seller hub / Admin when env URLs are set.
3. **Partners / Sell page** explaining how to become a seller and where to log in.
4. **No** vendor JWT, **no** admin routes, **no** CASL role matrix for staff.

## Implementation plan (ordered)

### P0 — Wiring (storefront)

- [x] Env: `VITE_MERCUR_VENDOR_URL`, `VITE_MERCUR_ADMIN_URL`
- [x] Footer Partners links
- [x] `/partners` page: seller vs admin entry, register link, runbook pointer
- [x] Help FAQ notes buyer-only roles + partners entry

### P1 — Ops readiness (backend / Mercur)

- [ ] `bun run dev:backend:fast` (or equivalent) so `:9000/seller` + `/dashboard` are up
- [ ] Seed/create admin user via invite
- [ ] Register ≥1 seller via member flow; admin approve
- [ ] Publish ≥1 product + offer so storefront catalog is non-empty
- [ ] Configure Ghana region + GHS + sales channel (no hardcodes in SPA)

### P2 — Ghana-specific ops (later)

- [ ] Shipping options per seller for GH
- [ ] COD path already Mode B on storefront; MoMo spine separate
- [ ] Optional: custom Mercur admin widgets (commission reports) — still in Mercur packages, not storefront

### P3 — Explicitly out of scope

| Item | Why |
|------|-----|
| SPA `/admin/*` routes | Dual-home anti-pattern |
| SPA seller dashboard clone | Mercur Vendor already exists |
| CASL in storefront for vendor_owner | Wrong auth actor (member vs customer) |
| Express dual-home re-enable | Archived |

## Auth gotchas (do not forget)

1. Vendor API uses **`member`** actor (`/auth/member/emailpass`), not a customer JWT.
2. After membership: send **`x-seller-id: sel_…`** on vendor routes.
3. Seller create may start as **`pending_approval`** until admin approves.
4. Product request flow: vendor **`proposed`** → admin **confirm** → **published**.

## Success criteria

| Check | Pass |
|-------|------|
| Buyer never needs vendor JWT | ✓ |
| Seller completes catalog path without seed inject | Per vendor runbook |
| Admin can approve seller + product | Per Mercur admin |
| Storefront links open real panels when API is up | Env URLs |
| No fake role UI in buyer SPA | ✓ |

## Related

- `apps/storefront/docs/ACCESS-AND-RBAC.md`
- `apps/backend/README.md`
- `docs/architecture/2026-07-16-mercur-vendor-rbac-catalog-runbook.md`
- `docs/architecture/2026-07-16-clean-slate-backend.md`
