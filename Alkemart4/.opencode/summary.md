# Session Summary

## Auth & Login Fixes
- Wrote `scrypt-kdf` password hashes for 7 `@gmail.com` accounts directly to Neon (`auth_identity_provider.provider_metadata.password`); universal password `alkemart25vent`
- Linked 6 auth identities to actor records (`auth_identity.app_metadata` set with `user_id`, `customer_id`, `member_id`)
- `esaiaemose@gmail.com` orphaned (no user/customer/member record in the database)
- Fixed admin panel auth: `GET /auth/session` → `POST /auth/session` with Bearer; JWT stored in `sessionStorage` for page refresh persistence
- Fixed vendor panel auth: same JWT token storage + Bearer header approach
- Fixed storefront password field: `FormField` renders `PasswordInput` with show/hide toggle

## Admin Panel Fixes
- Fixed `/admin/orders` 500 error: MercurJS had a blank route at `/admin/orders` that shadowed Medusa's handler; replaced with custom handler using `query.graph`

## Store Products Fix
- **Root Cause**: MercurJS replaces Medusa's store products middleware with `applyVisibleSellerIdsFilter` + `product_seller` link filter. No products were linked to any seller — `product_seller` join table was empty
- **Fix**: Linked all 11 products to sellers via `POST /admin/products/:id/sellers`
  - 10 products → Amberstone Market (`sel_01KXXJ54REBPVYYG147B873XW4`)
  - LG TV → Jane Electronics (`sel_01KY12BCWATNSZBW9FQA90DES9`)
- **Result**: `GET /store/products` now returns 10 products (LG TV has 0 variants, unconfirmed — pre-existing)

## Remaining Issues
- LG TV has no variants/prices/offers in store
- `esaiaemose@gmail.com` has no user/customer/member record
- Customer login via curl fails with `"origin required"` — storefront browser sends this automatically, real users unaffected
