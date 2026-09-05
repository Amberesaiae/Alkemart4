# Lifecycle — Vendor

## Flow

`register → admin approve → Ghana MoMo setup → product/offer create → propose → admin publish → fulfill (ship/deliver)`

Payouts are **admin-triggered**, not vendor self-serve.

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/vendor/auth/register` | `{ email, password, sellerName, sellerHandle }` → seller `pending_approval` |
| POST | `/vendor/auth/login` | JWT |
| GET | `/vendor/me` | Session |
| GET | `/vendor/onboarding/status` | Readiness |
| POST | `/vendor/onboarding/ghana-setup` | MoMo + Paystack transfer recipient |
| GET/POST | `/vendor/products` | List / create (product+variant+offer) |
| PATCH | `/vendor/products/:id` | Title/price/stock/active… |
| POST | `/vendor/products/:id/propose` | `draft` → `proposed` |
| GET | `/vendor/orders` / `/:id` | Seller-scoped |
| POST | `/vendor/orders/:id/ship` | `placed` → `shipped` |
| POST | `/vendor/orders/:id/deliver` | `shipped` → `delivered` |

## UI routes (`apps/backend/apps/ghana-vendor`)

| Route | Workers |
|-------|---------|
| `/login`, `/register` | Yes |
| `/` Dashboard | Yes |
| `/products`, `/products/$id`, `/quick-sell` | Yes |
| `/orders`, `/orders/$id` | Yes |
| `/settings` | Ghana setup |
| `/returns` | **Hidden** when Workers API |

## ACID checks

1. Unapproved seller cannot publish sellable offers into catalog.  
2. Product create is one tx: product + variant + offer.  
3. Fulfillment transitions enforced by domain (`assertFulfillmentTransition`).  
4. Delivered orders become payout-eligible (no duplicate `payout_lines`).

## Gaps

- No Workers image upload  
- No vendor returns / refunds  
- Offer CRUD folded into product endpoints only  
