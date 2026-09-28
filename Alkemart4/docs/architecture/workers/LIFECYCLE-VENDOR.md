# Lifecycle — Vendor

## Hosted authentication and pilot permissions

WorkOS migration is feature-gated and not deployed. A buyer may open a shop
without replacing their local identity or order history; vendor privileges
always come from current database membership, never provider role metadata.
Existing sellers link with explicit local password proof plus a verified
provider identity. Revocation and suspended/terminated write blocks apply on
every protected request. Same-origin Pages auth Functions avoid third-party
cookies on the current deployment URLs.

Pilot staff may operate catalog/collections/imports, fulfillment orders,
reviews/messages, uploads/videos and their preferences. Shop identity,
policies, financial decisions, payout/business/onboarding access and unknown
staff write surfaces require the owner. Payout destinations remain immutable
after initial setup. Verified owner email is not proof of payout-account
ownership or MFA: sensitive-action step-up and independent payout review
remain release gates. See `docs/ops/WORKOS-PILOT.md`.

## Flow

`register → verify email → /setup stepper → admin approve → product/offer create → propose → admin publish → fulfill (ship/deliver)`

Email verification uses a one-use, hashed token with a 30-minute expiry
(`/vendor/auth/verify-email/request|confirm`, UI `/verify-email`). Initial payout
setup requires the verified owner; existing destinations cannot be replaced
through the vendor session. Approval/reopening and new or retried payouts also
require a current verified owner. Email ownership does not replace independent
vendor identity and payout-account checks. Automatic payouts remain off for the pilot.

### First-run setup (`vendor-v2` `/setup`)

Registration lands on a five-step stepper, one decision per screen, saved as
you go ("Save and exit" loses nothing): **look** (logo, name, tagline) →
**location** → **delivery** (promise + fee, one save) → **payouts** (MoMo,
Paystack-checked) → **returns**. Location and payouts are required to sell;
the rest can be skipped. It opens at the first unfinished step; Home and Shop
show "Finish setting up · N of 5" until done. The steps are the same section
components as the Shop page (rendered bare, with "Save and continue"), so
setup and later edits never drift. Shop settings are tabs (Profile · Location
· Delivery & returns · Contact & hours · Share) instead of one long scroll.

### Delivery options and handover (0042)

Shop → Delivery & returns: delivery promise plus a fee per zone (same town /
same region / other regions, or off) and a pickup switch — one save
(`PATCH /vendor/sellers/me/fulfillment`). The same-town fee is also kept as the
legacy flat fee for older readers.

Orders: **trust by default.** "Mark as sent" / "Ready for pickup", or
"Already delivered/collected" straight from placed. Marking delivered never
needs anyone's approval; the buyer's 4-digit code is optional and, when
entered, releases an online payout at once (otherwise after the buyer's report
window). Wrong codes are counted; after the policy's limit code checking
stops, but the seller can still mark delivered. A buyer's reported problem
shows as a banner and holds only that order's payout until the buyer marks it
sorted. The seller never sees the code.

### Business and statements

`/business` (Home → "Business overview", account menu): overview for any
period with comparison, orders CSV, and monthly statements
(`/business/statements/:period`, CSV + print). API `GET /vendor/business/*`.
Statements are frozen per month (0043); the seller can keep them for records,
loans or tax.

### Pinpoint location

Sellers pick their dispatch spot on a map (`@alkemart/maps` LocationPicker):
search a street or landmark, use the phone's GPS, or move the map under a
fixed centre pin. Each pin is reverse-geocoded to street, area, town and
region, which fill the form (still editable). Buyers see area + town and
distance; the rider landmark stays private. The same picker lets buyers pin
their delivery spot at checkout; the seller's order shows a Maps link and the
rider share text includes it. Street search: `GET /store/places/search`,
`GET /store/places/reverse` (Ghana only, rate-limited, Nominatim-compatible
provider — see BUILD-LOG §14 for the production switch).

Payouts: once an order's money is released (handover code, the buyer's "I got
it", or the end of the report window) it joins the seller's next payout, which
admin sends with one press (**Pay everyone ready**). No commission in the pilot:
the seller gets the full price. (Automatic payouts are built but off.)

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/vendor/auth/register` | `{ email, password, sellerName, sellerHandle }` → seller `pending_approval` |
| POST | `/vendor/auth/login` | JWT |
| POST | `/vendor/auth/password-reset/request` | `{ email }` → emails `VENDOR_URL/reset-password?token=…` (same answer whether or not the account exists) |
| POST | `/vendor/auth/password-reset/confirm` | `{ token, password }` — one use, one hour. UI: `/forgot-password` (linked from sign-in) and `/reset-password` |
| GET | `/vendor/me` | Session |
| GET | `/vendor/onboarding/status` | Readiness |
| POST | `/vendor/onboarding/ghana-setup` | MoMo + Paystack transfer recipient |
| GET/POST | `/vendor/products` | List / create (product+variant+offer) |
| GET | `/vendor/payouts/statement` | Own money: pending/held/paid/**cash** lines + totals (Money tab). COD lines are `state: "cash"` — cash already with the seller, commission owed, never paid out (see LIFECYCLE-PAYMENT). Online orders refunded in full before payout are `state: "refunded"` (net 0). |
| GET/POST | `/vendor/collections` | Shelf CRUD (auto-slug, schedule, visibility) |
| PUT | `/vendor/collections/:id/products` | Replace membership (own products only, ≤30) |
| GET/PUT | `/vendor/preferences` | Dashboard alert topics (stock/price/sla/order/payout; all on by default) |
| PATCH | `/vendor/products/:id` | Title/price/stock/active… |
| PATCH | `/vendor/products/:id/variants/:variantId` | Price/stock/active + offer terms (`condition`, `compareAt*` + provenance, `fulfillmentOrigin`, `warrantyRef`, `returnsRef`, `deliveryPromise`); price moves append to history |
| POST | `/vendor/products/:id/propose` | `draft` → `proposed` |
| GET | `/vendor/orders` / `/:id` | Seller-scoped. List is newest first and carries `placedAt`, `itemCount`, `items[{productId,title,qty}]`, `shipTo{city,region}` (area only — never street/phone) and `paymentMethod`. Detail adds `placedAt`, `paymentMethod`, `paymentStatus` and the full `shippingAddress` for delivery. |
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

## Shop contact & social links
- `PATCH /vendor/sellers/me/contact` `social` accepts a handle, link or
  local number per platform (tiktok, instagram, facebook, whatsapp) and
  stores a canonical https URL on the platform's own host
  (`normalizeSocial` in `@alkemart/domain`); `""`/`null` removes it.
- Delivery promise (`PATCH /me/delivery`: days range + hand-over hours)
  is frozen onto each order at placement; editing it never changes
  existing orders. The storefront shop header shows it.

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
- Offer CRUD folded into product endpoints only

## Returns (0044)

Order page shows the buyer's return with three answers: **refund in full**,
**send a replacement**, or **decline** with a reason the buyer sees (want the
item back first? agree it with the buyer in Messages). Replying
before the deadline keeps the decision with the seller; silence sends it to
alkemart. Orders → **Returns** tab (badge "your reply"); Home task.
Money: online refunds come out of the order's payment; if the order was
already paid out, the seller's share (refund less the commission alkemart
gives back) comes off the next payout and shows on it. Pay on delivery: the
seller pays the buyer back and taps "I've paid the buyer back". Shop policy
"Buyers can return within" = change-of-mind days; faulty items always get
the platform's minimum. API: `GET /vendor/returns`,
`POST /vendor/returns/:id/{refund,replace,decline,refund-paid}`.

## Messages and questions (0045) — offers parked

Header inbox icon (badge = unread chats + unanswered questions + offers
waiting). Messages → Chats (reply with quick replies, report, block),
Questions (answers go public on the product page), Offers (accept, counter,
decline; offers under your hidden lowest price are declined for you). On a
product's price row: "Buyers can make offers" and an optional lowest price
that buyers never see. API: `/vendor/messages`, `/vendor/deals`.
