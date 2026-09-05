# Navigation / click matrix (Workers)

Purpose: manual QA (and optional future browser automation) cover **every Workers-visible primary control**. Mercur-only leftovers are asserted unlinked, not exercised. Browser Playwright is deferred; use this matrix by hand against Pages.

## Storefront

| Route | Must click / assert |
|-------|---------------------|
| `/` | Brand, category rail, product card → PDP, search submit |
| `/search?q=` | Results or empty state |
| `/browse/$slug`, `/categories/$slug` | PLP cards |
| `/product/$id` | Offer pick, ATC, seller chip → shop |
| `/cart` | Qty change, remove, Place order → checkout |
| `/checkout` | Address fields, COD (default), place order |
| `/checkout/pending` | Polling UI (MoMo) |
| `/checkout/card-callback` | Returns to order/pending |
| `/orders`, `/order/$id` | List + detail + shipping shown |
| `/login` | Login / register toggle, submit |
| `/account` | Shell loads |
| `/shops`, `/shops/$slug` | Index + shop |
| `/help`, `/about`, `/contact`, `/delivery`, `/partners`, `/sell` | Content shell 200, no crash |
| `/order/$id/return` | Honest “not available” (no fake success) |
| `/account/wishlist` | Honest empty / unavailable on Workers |

Header/footer: account menu, orders, help, language control if present.

## Vendor

| Route | Must click / assert |
|-------|---------------------|
| `/login`, `/register` | Forms submit |
| `/` | Dashboard shell |
| `/products` | List / empty; open product; quick-sell entry |
| `/products/$id` | Edit fields save |
| `/orders`, `/orders/$id` | Ship / deliver when eligible |
| `/settings` | Ghana setup fields |
| `/returns` | Not in Workers nav |

Mobile tab bar: Dashboard / Products / Orders / Settings.

## Admin

| Route | Must click / assert |
|-------|---------------------|
| `/login` | Admin login |
| `/sellers-queue`, `/sellers`, `/sellers/$id` | Approve / suspend actions |
| `/product-moderation` | Approve / reject |
| `/orders`, `/orders/$id` | Detail |
| `/payouts` | Trigger payout form |

Assert analytics/markets/returns/etc. **not** in sidebar when Workers API.

## Cross-door smoke

1. Storefront Pages 200 + Alkemart brand  
2. Vendor Pages 200 + login heading  
3. Admin Pages 200 + login heading  
4. Dist / live storefront has **no** Medusa SDK chunk when Workers URL baked  
