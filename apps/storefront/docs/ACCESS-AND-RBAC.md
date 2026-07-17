# Access & RBAC — storefront vs Mercur

This app (`apps/storefront`) is the **buyer** surface only. Multi-role admin/vendor
RBAC is **not** re-implemented here; it lives in Mercur.

## Roles

| Role | Where | Screens / workflows |
|------|--------|---------------------|
| **Guest** | Storefront | Browse, search, PDP, cart, COD checkout, order-by-id, help |
| **Customer** (signed-in) | Storefront | Guest + account, profile update, saved addresses, account order list |
| **Seller / vendor** | Mercur Seller Hub (`VITE_MERCUR_VENDOR_URL`) | Catalog, offers, shipping, fulfillments |
| **Admin / ops** | Mercur Admin (`VITE_MERCUR_ADMIN_URL`) | Regions, users, platform config |
| **Support** | Mercur / future ops tools | Not in buyer SPA |

Legacy Express CASL roles (`buyer`, `vendor_owner`, `admin`, …) apply to the
archived dual-home stack, not this greenfield buyer SPA.

## Buyer workflows (storefront)

| Workflow | Status |
|----------|--------|
| Catalog browse / search / PDP | Implemented |
| Cart + offer_id lines | Implemented |
| COD checkout + shipping attach | Implemented (Mode B) |
| Guest order find-by-id | Implemented |
| Register / login / logout | Implemented |
| Cart transfer on login | Best-effort if SDK supports it |
| Profile name/phone update | Implemented |
| Saved addresses + default | Implemented |
| Account order list | Implemented |
| MoMo / Paystack charge | **Not** in SPA (spine separate) |
| Disputes / chat / returns | **Not** buyer SPA (ops) |
| Seller onboarding | Mercur only |
| Admin moderation | Mercur only |

## Enforcement model

- Store API + publishable key for public store routes.
- Customer JWT for `/account`, addresses, customer order list.
- Guest may still open `/order/$id` if the API allows retrieve by id.
- No local hardcoding of roles or “fake admin” UI.

## Intentionally out of storefront scope

Do not add SPA admin panels, vendor dashboards, or dual-home CASL screens here.
Link out to Mercur for Sell / Admin via **`/partners`** and footer Partners.

## Ops plan

See monorepo ADR: `docs/architecture/2026-07-16-ops-rbac-surfaces.md`  

**Master E2E handbook:** `docs/architecture/2026-07-17-complete-e2e-architecture-procedures.md`

| Local panel | Path |
|-------------|------|
| API | `http://localhost:9000` |
| Admin | `http://localhost:9000/dashboard` |
| Seller | `http://localhost:9000/seller` |
| Seller register | `http://localhost:9000/seller/register` |

Vendor API actor is **`member`** (not customer JWT). Full catalog path:
`docs/architecture/2026-07-16-mercur-vendor-rbac-catalog-runbook.md`.
