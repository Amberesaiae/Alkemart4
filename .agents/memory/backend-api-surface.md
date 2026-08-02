---
name: Backend API surface — vendor & admin routes
description: What routes exist, what's missing, and key implementation decisions for the Alkemart4 backend
---

# Backend API Surface

## Vendor orders (added in task #11)
All vendor order routes now live at `/vendor/alkemart/orders/*`:
- `GET /vendor/alkemart/orders` — list, scoped to seller via `order_seller` link entity
- `GET /vendor/alkemart/orders/:id` — detail (403 if not seller's order)
- `POST /vendor/alkemart/orders/:id/fulfillments` — create fulfillment (uses `Modules.FULFILLMENT` service)
- `POST /vendor/alkemart/orders/:id/fulfillments/:fid/shipments` — mark shipped
- `POST /vendor/alkemart/orders/:id/fulfillments/:fid/mark-as-delivered` — mark delivered
- `POST /vendor/alkemart/orders/:id/cancel` — soft cancel request (sets metadata, admin confirms)

**Why:** Vendor dashboard had the UI for all these but every call was a 404.

## Admin routes added
- `GET /admin/orders/:id` — full order detail
- `POST /admin/orders/:id/cancel` — hard cancel (uses `Modules.ORDER.cancelOrder` with updateOrders fallback)
- `GET /admin/sellers` — paginated list
- `POST /admin/sellers/:id/unsuspend` — via `MercurModules.SELLER.updateSellers()`
- `POST /admin/sellers/:id/terminate` — requires reason; irreversible
- `POST /admin/sellers/:id/commission` — sets `metadata.commission_bps`
- `GET /admin/returns` + `GET /admin/returns/:id` — uses `return` entity via query.graph
- `POST /admin/returns/:id/approve` — updates return status to "received" via ORDER module
- `POST /admin/returns/:id/reject` — cancels return with reason
- `POST /admin/returns/:id/refund` — Paystack refund via `refundCharge()` using payment.data.reference
- `POST /admin/payouts` — triggers Paystack transfer directly (payout_account must have recipient_code)
- `GET /admin/disputes` + `POST /admin/disputes` — disputes are returns with `metadata.is_disputed=true`
- `GET /admin/disputes/:id` + `POST /admin/disputes/:id/resolve`

## Key patterns
- Seller ID in vendor routes: `req.seller_context?.seller_id || req.session?.seller_id || req.get("x-seller-id")`
- Vendor ownership check: query `order_seller` entity with `{seller_id, order_id}` filter
- Seller status mutations: use `MercurModules.SELLER` (not Mercur workflows — terminate/unsuspend not exported as workflows)
- Return status mutations: `Modules.ORDER.updateReturns` — may be undefined; wrapped with existence check + logger.warn fallback
- Disputes are not a separate entity — they are return metadata flags (`is_disputed: true`, `dispute_status`, etc.)
- Cancel order: try `Modules.ORDER.cancelOrder()` first, fallback to `updateOrders` with status="canceled"

**Why:** Mercur doesn't export unsuspend/terminate workflows; ORDER module updateReturns availability varies.

## Return lifecycle subscriber
`src/subscribers/return-lifecycle-notify.ts` handles:
- `order.return_requested` → vendor SMS + admin WhatsApp (admin phone from `ADMIN_ALERT_PHONE` env)
- `order.return_approved` → buyer SMS
- `order.return_rejected` → buyer SMS with reason

## Refund payment reference lookup
Paystack reference lives in `payment.data.reference` OR `payment.data.ghana_charge_ref`. Both are checked.
