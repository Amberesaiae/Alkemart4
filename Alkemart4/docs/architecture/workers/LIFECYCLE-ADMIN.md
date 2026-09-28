# Lifecycle — Admin

Production reporting queries use Drizzle's timestamp-column encoders for
range bounds; raw aggregate timestamp bounds are explicitly ISO-encoded.
The same rule applies to payout-statement ranges and return-deadline sweeps.
`apps/api/src/postgres-reporting.test.ts` checks the actual Drizzle-to-driver
parameters without requiring a live database.

## Flow

Production domain rollout uses `console.alkemart.com`, with the existing Access
audience, two-email Google allowlist, and independent MFA retained. Custom domains
are active. Deployment tooling now rejects a dirty tree; the API CORS source
permits exact custom origins and excludes development origins in production.
Backend Access enforcement and the admin proxy remain undeployed pending a
reviewed release; frontend domain protection alone does not close API bypass.

Security hardening (local, not deployed): admin sessions expire after one hour;
legacy seven-day tokens are refused. Browser storage is tab-scoped. Admin/seller
authorization checks current role, password-change stamp and seller membership.
Demo rotation stamps revocation and audits affected emails without passwords.
Distributed auth/checkout throttling and signup verification require configured
production bindings/keys. Cloudflare Access now gates the admin Pages host and
previews with Google, two allowed emails and independent MFA. Direct Worker API
protection and the Pages same-origin proxy are implemented locally but not yet
deployed; the production API remains bypassable until that rollout is verified.
See [`SECURITY-HARDENING.md`](../../ops/SECURITY-HARDENING.md) for rollout gates.

`login → seller approve/moderate → product moderate → orders → payouts` (+ migrate helpers)

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/admin/auth/login` | No public register |
| GET | `/admin/me` | Session |
| GET | `/admin/sellers` | List |
| POST | `/admin/sellers/:id/{approve,suspend,unsuspend,terminate}` | Status |
| POST | `/admin/sellers/:id/commission` | `commissionBps` |
| GET | `/admin/sellers/:id/verifications` | Verification evidence list |
| POST | `/admin/sellers/:id/verifications` | Issue (`kind`, `evidence?`); audit-logged |
| POST | `/admin/sellers/:id/verifications/:verificationId/revoke` | Revoke with `reason`; audit-logged |
| GET | `/admin/products?status=` | Moderation queue |
| POST | `/admin/products/:id/{approve,reject,request-changes}` | Transitions |
| GET | `/admin/orders` / `/:id` | OrderGroups |
| POST | `/admin/payouts` | `{ sellerId }` → Paystack transfer + DB batch |
| GET | `/admin/payouts/holds?seller_id=` | Hold list (`&all=1` for history) |
| POST | `/admin/payouts/holds` | Hold order/seller balance (`reason` required); audit-logged |
| POST | `/admin/payouts/holds/:id/release` | Release; audit-logged |
| GET | `/admin/campaigns/placements` | Fixed inventory slots |
| GET/POST | `/admin/campaigns` | List / create draft (schedule, priority, sponsored) |
| GET/PATCH/DELETE | `/admin/campaigns/:id` | Detail (sets, creatives, audit) / edit draft+review / delete drafts |
| POST | `/admin/campaigns/:id/transitions` | submit→approve→publish→end (gated); audit-logged |
| POST/DELETE | `/admin/campaigns/:id/creatives[/:creativeId]` | Desktop/mobile creative CRUD |
| POST | `/admin/campaigns/:id/{products,sellers}` | Replace set membership (validated) |
| GET | `/admin/campaigns/:id/report` | Views/selects by placement + creative |
| GET/POST | `/admin/experiments` | Experiment registry (kebab key, control %, metric, guardrails) |
| GET/PATCH | `/admin/experiments/:id` | Detail + exposure report / status machine + frozen control % |
| GET | `/admin/feed/diagnostics` | Feed↔landing agreement + exclusion counts |
| GET | `/admin/taxonomy/proposals/review` | Other-bucket, thin-leaf, rejected-match leads (human approves; nothing auto-applies) |
| GET/POST | `/admin/guides` | Guide list / create draft |
| GET/PATCH | `/admin/guides/:slug` | Detail / edit (sections, links, refresh date) |
| POST | `/admin/guides/:slug/{publish,unpublish}` | Publish (needs a section) / unpublish |
| DELETE | `/admin/guides/:slug` | Delete drafts (cleans inbound links) |
| POST | `/admin/migrate/shipping-address` | Idempotent DDL |
| POST | `/admin/migrate/schema` | Known patches |
| POST | `/admin/migrate/link-demo-vendor-to-seller-a` | Demo remap |
| POST | `/admin/migrate/rotate-demo-passwords` | Body: new passwords for demo emails |
| POST | `/admin/migrate/blueprint-phase3` | Verification evidence + price-history DDL |
| POST | `/admin/migrate/blueprint-phase4` | Payout-holds DDL |

## UI (`apps/admin-v2`)

Nav (`src/lib/nav.ts`), daily work first:

- **Overview** — "Needs attention": returns to decide, refunds to check,
  sellers ready to pay, reported chats, then the review queues (seller
  applications, listings, appeals, buyer reviews). Marketplace numbers come
  from `GET /admin/stats`, which reads the same domain summary as Business
  (`platformSummary` in `apps/api/src/lib/business.ts`): orders not
  cancelled, item value without delivery fees, one order per shop. The
  Sellers list's per-shop orders and sales use the same summary.
- **Operations** — Orders, Returns & disputes, Payouts, Reports, Buyer reviews.
- **Sellers** — Sellers, Appeals. **Catalogue** — Listings, Categories.
  Listing review mode (Listings → "Who reviews listings"): **Trust shops**
  (default) — a listing that passes every rule goes live at once, and so does
  a clean edit to a live listing; anything flagged (banned words, price
  outlier, duplicate) or doubted by AI waits for a person. Also Manual,
  AI assists, AI decides. A mode saved in `platform_settings` wins over the
  default.
- **Buyer reviews** — verified purchases publish at once; only ones with a
  phone number, email, link or off-platform ask wait ("Waiting" tab,
  `reviewNeedsCheck` in the domain). "Live" lists the newest published
  reviews so admin can hide abuse.
- **Storefront** — Homepage. **Insights** — Business. **Platform** — Rules.
- **Growth** (built, not part of pilot daily work) — Campaigns, Guides,
  Search & traffic.

## ACID checks

1. Approve seller → vendor can complete Ghana setup and list.  
2. Approve proposed product → offer appears in `/store/catalog`.  
3. Payout after deliver creates unique `payout_lines` per order.  
4. Migrate endpoints are idempotent.

## Gaps

- `POST /admin/sellers/:id/terminate` has no button (suspend covers the pilot).
- Order detail (`GET /admin/orders/:id`) isn't opened from the UI; Orders
  shows each seller's part inline.

## Rules (platform settings)

Admin → Rules edits the delivery policy (`GET/PUT /admin/settings/delivery-policy`):
report windows (same-day / other), same-town distance, handover code tries.
Defaults and validation live in `packages/domain` (`DEFAULT_DELIVERY_POLICY`,
`parseDeliveryPolicy`); values are stored in `platform_settings` and every
change is audit-logged. Admin does not confirm deliveries — buyers and sellers
do; admin only resolves reports they can't settle.

## Business (overview, exports, statements)

Admin → Insights → Business: the platform's overview for any period, or one
shop's (the seller's exact view) via the shop selector; orders CSV; platform
or shop statements. API `GET /admin/business/overview|orders.csv|statements`
with optional `?sellerId=`. Numbers come only from `packages/domain`
(`summarize`, `buildStatement`); statements freeze on first view after the
month ends, so no one has to "close the month".

## Returns & disputes (0044)

Admin → Operations → **Returns & disputes** (nav badge = cases to decide).
Views: needs a decision (escalated by the buyer or a missed seller deadline),
open, refunds to check (failed at Paystack, or owed by a pay-on-delivery
seller), closed. Each case expands inline: order facts, whether the seller
was already paid out, the timeline, and a
decision (refund the buyer in full, or side with the seller) with a reason
both sides see. Decisions and refund retries are audit-logged.
Return windows are fixed defaults in the domain (`DEFAULT_RETURN_POLICY`),
not admin settings.

## Reports (0045)

Operations → **Reports**: conversations a buyer or seller reported — the only
messages admin can read (each opening audit-logged). Close the conversation
for both sides or dismiss. Product questions can be hidden.

Make an offer (0046) is parked (PILOT-PLAN phase 5): the buyer and seller
routes aren't mounted. `GET/PUT /admin/settings/deal-policy` still answers,
but Rules doesn't show it.
