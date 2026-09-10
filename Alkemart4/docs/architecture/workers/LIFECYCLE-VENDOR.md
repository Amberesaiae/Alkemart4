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
| GET | `/vendor/sellers/me` | Profile + `storefront` block (tagline/announcement/SEO, `announcementActive`) |
| PATCH | `/vendor/sellers/me/storefront` | `{ tagline?, bio?, announcement?|null, seoDescription? }` → merged into `sellers.metadata.storefront`; URL-free + scam-phrase + `endsAt > startsAt` validation; `bio` writes seller description |
| POST | `/vendor/sellers/me/pause` | `{ note?, until? }` → `availability=paused`; future `until` only |
| POST | `/vendor/sellers/me/unpause` | Back to `availability=open`, clears note/until |
| GET/POST | `/vendor/sellers/me/policies` | `{ shipping?, returnsDays?, warranty? }` append-only versions; current + history |
| PATCH | `/vendor/sellers/me/display` | `{ categoryOrder?, featuredCategoryId?, stockMode? }` — category ids validated against shared taxonomy |
| PATCH | `/vendor/sellers/me/contact` | `{ phone? (E.164), hours? ({days, open, close}), social? }` — social URLs domain-allowlisted (instagram/facebook/tiktok/wa.me) |
| GET/PUT | `/vendor/sellers/me/featured` | Ranked shelf, ≤ 8 own products; replace-wholesale, order = rank |
| POST | `/vendor/orders/:id/ship` · `/deliver` | Status flip + fire-and-forget buyer SMS enqueue (never blocks) |

## UI routes (`apps/backend/apps/ghana-vendor`)

| Route | Workers |
|-------|---------|
| `/login`, `/register` | Yes |
| `/` Dashboard | Yes |
| `/products`, `/products/$id`, `/quick-sell` | Yes |
| `/orders`, `/orders/$id` | Yes |
| `/settings` | Ghana setup |
| `/store` | Branding/announcement/SEO + availability + policies + display + featured + contact editors + live `/shops/:handle` preview; explicit Publish |
| `/reviews` | Reserved skeleton (buyer reviews ship separately) |

## Fulfillment SMS

Ship/deliver flips enqueue one outbox row (`notifications`, unique key
`${orderId}:${status}`) with the buyer's E.164 phone from the payment
intent. The cron + `POST /admin/migrate/send-notifications` sender claims
due rows (`FOR UPDATE SKIP LOCKED`), sends via Africa's Talking, and marks
sent/failed with retry to 5 attempts. No phone → no row. Provider outage
never blocks the status write; re-runs never double-text.

## Pause mode

`POST /store/checkout` rejects carts containing a paused seller's offers with
409 (server-enforced, never button-only). Paused shops keep listings visible:
`/shops/:handle` shows the vendor note + return date, and the PDP disables
add-to-cart with the pause reason. Policies are append-only
(`shop_policy_versions`); the highest version is in force.
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
