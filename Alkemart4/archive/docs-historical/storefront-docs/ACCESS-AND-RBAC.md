# Access & RBAC — storefront vs Mercur

This app (`apps/storefront`) is the **buyer** surface only. Multi-role admin/vendor
RBAC is **not** re-implemented here; it lives in Mercur.

**Production audit (2026-07-19):**  
`docs/architecture/2026-07-19-rbac-workflow-production-audit.md`  
**Verdict: not production-ready** for guest order integrity + checkout↔account bind.

## Roles

| Role | Where | Screens / workflows |
|------|--------|---------------------|
| **Guest** | Storefront | Browse, search, PDP, cart, COD checkout, **order lookup**, help |
| **Customer** (signed-in) | Storefront | Guest + account, profile, addresses, account order list |
| **Seller / vendor** | Mercur Seller Hub (`VITE_MERCUR_VENDOR_URL`) | Catalog, offers, shipping, fulfill |
| **Admin / ops** | Mercur Admin (`VITE_MERCUR_ADMIN_URL`) | Approve sellers/products, regions |
| **Support** | Mercur / future | Not in buyer SPA |

Legacy Express CASL roles (`buyer`, `vendor_owner`, `admin`, …) apply only to
`archive/` — not this stack.

## Buyer workflows

| Workflow | Status | Notes |
|----------|--------|--------|
| Catalog / search / PDP | OK | Public + publishable key |
| Cart + offer_id | OK | Guest cart_id capability |
| COD checkout | Mode B | Server does not require JWT |
| Guest order lookup | **Fixed** | `/orders` no longer requires login for lookup UI |
| Guest order PII policy | **GAP** | Server retrieve policy must be proven (IDOR vs 401) |
| Register / login | OK | JWT in localStorage (XSS risk) |
| Cart transfer on login | **GAP** | Not reliably implemented |
| Checkout → My Orders | **GAP** | Ghana checkout does not bind customer_id |
| Profile / addresses | OK | Customer JWT |
| Account order list | OK when bound | JWT |
| Seller / admin panels | Out of SPA | Deep links only |

## Enforcement model

| Layer | Real? |
|-------|--------|
| SPA `requireAuth` | UX redirect only (`/account`) |
| Customer store APIs | Real JWT |
| Guest cart / checkout | cart_id + publishable key |
| Seller / admin APIs | Different actors — buyer JWT denied |

## Intentionally out of storefront scope

- SPA `/admin/*` or seller dashboards  
- CASL staff matrix  
- Trusting `customer.metadata.roles` for privileges  

## Ops panels (local)

| Panel | Path |
|-------|------|
| API | `http://localhost:9000` |
| Admin | `http://localhost:9000/dashboard` |
| Seller | `http://localhost:9000/seller` |

Vendor API actor is **`member`** (not customer JWT).

## Production sign-off checklist

See §8 in `2026-07-19-rbac-workflow-production-audit.md`.
