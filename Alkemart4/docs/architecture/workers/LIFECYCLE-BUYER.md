# Lifecycle — Buyer

## Flow

`register/login → browse/search → PDP → cart → checkout (COD|MoMo|card) → order detail`

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/store/auth/register` | `{ email, password }` |
| POST | `/store/auth/login` | JWT |
| GET | `/store/categories` | Nav tree |
| GET | `/store/catalog?q=&category=&limit=&offset=` | Browse/search — targeted slice: published products (status index) + offers/variants by product id (0028); transient pooler blips retried, never a 500 on first timeout |
| GET | `/store/search?q=&...` | Typo-tolerant search — trigram-ranked ids (GIN, 0031) + slice; token scoring bypassed for ranked ids; facets/filters/cards contract unchanged |
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
| GET | `/store/cart/:id` | Cart + quote; each item carries `productId` (for line links/art) |
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
| `/order/$id/return` | Redirects to the order (returns live on the order page) |
| `/login`, `/signin`→login, `/account`, `/account/wishlist` | Auth / account |
| `/shops`, `/shops/$slug`, `/sellers`, `/sell`, `/help`, `/about`, `/contact`, `/delivery`, `/partners` | Content / entry |

## ACID checks

1. Cart line always references a live `offerId`.  
2. COD: intent → immediate `confirmPaidOrder`; shipping_address stored (with the buyer's optional map pin `latitude`/`longitude`; saved to the address book too, 0041).  
3. MoMo/card pending: stock reserved until confirm or fail/release.  
4. Multi-seller cart → one OrderGroup, N seller orders.  
5. Order detail requires auth (or matching email policy).

## UI routes (`apps/storefront-v2`, port 5176 — replacement in progress)

Same buyer flow, Workers-only (no Medusa code), market-driven (`src/lib/market.ts`).

| Route | Role |
|-------|------|
| `/`, `/categories`, `/categories/$slug`, `/search` | Discovery (studio course, server-side price/attribute filters) |
| `/product/$id` (`?offer=`) | PDP — shared offer-selection rules with the card quick-buy sheet |
| `/shops`, `/shops/$slug`, `/shops/collections/$collectionId` | Stores |
| `/cart`, `/checkout`, `/checkout/pending`, `/checkout/card-callback` | Cart / pay |
| `/orders`, `/order/$id` | Orders (per-seller timelines, verified-purchase review on delivered orders) |
| `/login`, `/account`, `/saved` | Account; Saved is device-local |
| `/help`, `/delivery`, `/about`, `/contact`, `/sell`, `/guides`, `/privacy`, `/terms` | Content |
| `/signin`, `/browse/$slug`, `/store/$slug`, `/sellers`, `/account/wishlist`, `/order/$id/return` | Legacy redirects |

Issues found in the old storefront during the port: `apps/storefront-v2/docs/ISSUES-FOUND.md`.

## Not in SoR yet

Address book CRUD, wishlist persistence, full-text search (substring `q` only).

## Delivery options, handover code, reports (0042)

- Checkout step 2 shows, per seller, delivery (priced for the buyer's town,
  region or map pin) and/or free pickup — `GET /store/checkout/options`.
  Nothing is guessed before a town, region or pin is entered. A seller who
  can't serve the buyer blocks checkout with a plain message.
- The fee is recomputed server-side at checkout and frozen on the order.
- Order page: the 4-digit handover/pickup code (until delivered), pickup spot
  with directions, "I got my order" / "I collected it" (confirms and releases
  the seller's payment), "There's a problem" (tells the seller, holds that
  order's payment) and "It's sorted". Signed-in buyers use their session;
  guests prove it with the checkout email (`POST /store/orders/:orderId/received|problem|problem/resolved`).
- The order email includes each seller's code.

## Returns and disputes (0044)

- "There's a problem" on each package asks **what's wrong** (the API lists
  the reasons open right now, each with its last day) and **what they'd
  like** (money back or a replacement), plus a note. "Something else" is the
  phase-1 note to the seller.
- Windows (after delivery only): change of mind within the shop's returns
  days (the policy in force when the order was placed); damaged / wrong / not
  as described for at least 7 days.
- The case shows who's next and by when. The seller refunds, replaces or
  declines. After a decline the buyer accepts it or asks alkemart to decide;
  a silent seller hands it to alkemart automatically.
- Refunds: online → back to how they paid (Paystack); pay on delivery → the
  seller pays back and marks it. Refunded amounts show on the order.
- **alkemart Buyer Protection** line on product, checkout and order pages
  (`GET /store/protection`); cash checkout says honestly that cash isn't held.
- API: `POST /store/orders/:orderId/return` `{ reason, wish, note, email? }`,
  `POST /store/orders/:orderId/return/respond` `{ action: accept|escalate|withdraw }`.
  Order JSON: `returnCase`, `returnOptions`, `refundedPesewas`.

## Messages and questions (0045)

Signed-in buyers message a shop from the product page ("Message the shop")
or an order ("Message"); one conversation per shop and subject. Quick
starters come from the API. A message with a phone number, email or talk of
paying outside shows "Pay only through alkemart" to both sides. Report or
block from the conversation. Product pages show answered questions and let a
signed-in buyer ask the shop they're buying from. API: `/store/messages`,
`/store/questions`.

## Make an offer (0046) — parked 2026-09-27, not live

On a negotiable listing, a signed-in buyer offers a price for a quantity.
Too low for the seller's hidden floor → declined at once. The seller accepts
or counters; an accepted price shows in the cart ("Your offer price") and is
charged at checkout for that buyer, listing and quantity until it expires.
API: `/store/deals`; cart and checkout read the buyer's session.

