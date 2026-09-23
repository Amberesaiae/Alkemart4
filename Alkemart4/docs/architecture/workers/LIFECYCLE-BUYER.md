# Lifecycle — Buyer

## Flow

`register/login → browse/search → PDP → cart → checkout (COD|MoMo|card) → order detail`

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/store/auth/register` | `{ email, password }` |
| POST | `/store/auth/login` | JWT |
| GET | `/store/categories` | Nav tree |
| GET | `/store/catalog?q=&category=&limit=&offset=` | Browse/search |
| GET | `/store/products/:id` | PDP + peer offers |
| GET | `/store/products/:id/peers?variant_id=&sort=` | Variant-safe comparison (`total`/`price`/`delivery`/`trust`) + explanation + per-offer price history; Level C → `comparisonEligible: false` |
| GET | `/store/sellers/:handle/verifications` | Decomposed verification evidence (`meaning` per badge) |
| GET | `/store/collections?seller_id=` | Live shop shelves with ranked cards |
| GET | `/store/collections/:id?seller_id=` | One live shelf (draft/scheduled/expired → 404) |
| GET | `/store/course` | Resolved placements (winning campaigns + cards) + rule shelves |
| POST | `/store/course/events` | View/select beacon (no PII, 202) |
| GET | `/store/sitemap` | Live indexable URL set (products/categories/shops/collections) |
| GET | `/store/feed` | Merchant feed rows (JSON; XML renders at build) |
| GET | `/store/guides` | Published buying guides |
| GET | `/store/guides/:slug` | Guide with live catalog picks |
| GET | `/store/products/:id/alternatives` | Governed similar products (sellable-only, ≤2 per seller) |
| GET/PUT | `/store/preferences` | Preference center (promo opt-in, operational opt-out; transactional locked) |
| GET/POST | `/store/subscriptions` | Stock/price alert subscriptions (contact from session; one-shot) |
| DELETE | `/store/subscriptions/:id` | Unsubscribe |
| GET | `/store/experiments/assign?experiment=&unit=` | Deterministic bucket (control holdout default) |
| GET | `/store/sellers` / `/store/sellers/:handle` | Shops |
| POST | `/store/cart` | Create |
| POST | `/store/cart/:id/items` | `{ offerId, qty }` |
| PATCH | `/store/cart/:id/items/:itemId` | Qty (`0` removes) |
| GET | `/store/cart/:id` | Cart + quote |
| POST | `/store/checkout` | `method` + `shippingAddress` (+ MoMo/card fields) |
| GET | `/store/checkout/status?cartId=` | Poll / verify |
| GET | `/store/orders` | Auth list |
| GET | `/store/orders/:id` | OrderGroup detail |
| POST | `/store/orders/lookup` | Guest lookup |

## UI routes (`apps/storefront`)

| Route | Role |
|-------|------|
| `/`, `/search`, `/browse/$slug`, `/categories/$slug` | Discovery |
| `/product/$id` | PDP |
| `/cart`, `/checkout`, `/checkout/pending`, `/checkout/card-callback` | Cart / pay |
| `/orders`, `/order/$id` | Orders |
| `/order/$id/return` | Stub — Workers returns not implemented |
| `/login`, `/signin`→login, `/account`, `/account/wishlist` | Auth / account |
| `/shops`, `/shops/$slug`, `/sellers`, `/sell`, `/help`, `/about`, `/contact`, `/delivery`, `/partners` | Content / entry |

## ACID checks

1. Cart line always references a live `offerId`.  
2. COD: intent → immediate `confirmPaidOrder`; shipping_address stored.  
3. MoMo/card pending: stock reserved until confirm or fail/release.  
4. Multi-seller cart → one OrderGroup, N seller orders.  
5. Order detail requires auth (or matching email policy).

## Not in SoR yet

Returns, address book CRUD, wishlist persistence, full-text search (substring `q` only).
