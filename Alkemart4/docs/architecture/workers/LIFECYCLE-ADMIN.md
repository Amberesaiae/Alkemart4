# Lifecycle — Admin

Production reporting queries use Drizzle's timestamp-column encoders for
range bounds; raw aggregate timestamp bounds are explicitly ISO-encoded.
The same rule applies to payout-statement ranges and return-deadline sweeps.
`apps/api/src/postgres-reporting.test.ts` checks the actual Drizzle-to-driver
parameters without requiring a live database.

## Flow

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

## UI routes (`apps/backend/apps/admin`) — Workers nav

Workers-visible (`workers: true` in sidebar):

- `/orders`, `/orders/$id`
- `/payouts`
- `/sellers-queue`, `/sellers`, `/sellers/$id`
- `/product-moderation`
- `/categories` (Workers taxonomy board: nodes table + Phase 8D proposals review; create proposes, retirement via deprecate-with-replacement — no hard delete)
- `/login`

**Hidden on Workers:** analytics, markets, featured, promotions, returns, disputes, commission-rates UI. Routes may still exist in the SPA; nav must not link them when `isWorkersApi`.

## ACID checks

1. Approve seller → vendor can complete Ghana setup and list.  
2. Approve proposed product → offer appears in `/store/catalog`.  
3. Payout after deliver creates unique `payout_lines` per order.  
4. Migrate endpoints are idempotent.

## Gaps

- No Workers promotions CRUD  
- Payout list endpoint soft-empty in UI  

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

## Reports (0045) and offer rules (0046)

Operations → **Reports**: conversations a buyer or seller reported — the only
messages admin can read (each opening audit-logged). Close the conversation
for both sides or dismiss. Product questions can be hidden. Rules → **Make an
offer**: accepted-price hours, reply hours, lowest offer %, open offers per
buyer (`/admin/settings/deal-policy`).
