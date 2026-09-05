# Lifecycle — Admin

## Flow

`login → seller approve/moderate → product moderate → orders → payouts` (+ migrate helpers)

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/admin/auth/login` | No public register |
| GET | `/admin/me` | Session |
| GET | `/admin/sellers` | List |
| POST | `/admin/sellers/:id/{approve,suspend,unsuspend,terminate}` | Status |
| POST | `/admin/sellers/:id/commission` | `commissionBps` |
| GET | `/admin/products?status=` | Moderation queue |
| POST | `/admin/products/:id/{approve,reject,request-changes}` | Transitions |
| GET | `/admin/orders` / `/:id` | OrderGroups |
| POST | `/admin/payouts` | `{ sellerId }` → Paystack transfer + DB batch |
| POST | `/admin/migrate/shipping-address` | Idempotent DDL |
| POST | `/admin/migrate/schema` | Known patches |
| POST | `/admin/migrate/link-demo-vendor-to-seller-a` | Demo remap |
| POST | `/admin/migrate/rotate-demo-passwords` | Body: new passwords for demo emails |

## UI routes (`apps/backend/apps/admin`) — Workers nav

Workers-visible (`workers: true` in sidebar):

- `/orders`, `/orders/$id`
- `/payouts`
- `/sellers-queue`, `/sellers`, `/sellers/$id`
- `/product-moderation`
- `/login`

**Hidden on Workers:** analytics, markets, categories, featured, promotions, returns, disputes, commission-rates UI. Routes may still exist in the SPA; nav must not link them when `isWorkersApi`.

## ACID checks

1. Approve seller → vendor can complete Ghana setup and list.  
2. Approve proposed product → offer appears in `/store/catalog`.  
3. Payout after deliver creates unique `payout_lines` per order.  
4. Migrate endpoints are idempotent.

## Gaps

- No Workers returns/disputes/promotions/categories CRUD  
- Payout list endpoint soft-empty in UI  
