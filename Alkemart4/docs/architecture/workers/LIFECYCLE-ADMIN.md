# Lifecycle — Admin

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

- No Workers returns/disputes/promotions CRUD  
- Payout list endpoint soft-empty in UI  
