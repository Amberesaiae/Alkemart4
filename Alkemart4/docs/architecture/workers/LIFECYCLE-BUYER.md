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
