# Alkemart Production Plan — Neon + Medusa + Ghana Paystack (replanned)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.  
> **Supersedes for production strategy:** `2026-07-15-medusa-production-readiness.md` where it conflicts (especially seed-as-catalog and dual-backend permanence).  
> **Still binding:** Commercial spine ADRs in `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md` (ADR-002…014).

| Field | Value |
|---|---|
| **Date** | 2026-07-15 |
| **Status** | Canonical production plan (replanned) |
| **Database** | **Neon PostgreSQL** (same project today: `ep-polished-scene-…/neondb`) |
| **Commerce engine** | Medusa v2.17.x |
| **Payments** | **Paystack Ghana — Mobile Money first**, COD second |
| **Data truth** | **Real Neon rows** (Express Drizzle today → Medusa tables after migrate) — **not seed** |

---

## 0. What changed in this replan (read first)

| Old / mistaken path | Correct production path |
|---|---|
| `seed-ghana` creates production catalog | Seed is **dev/CI only**; refuse in `NODE_ENV=production` |
| Fake Samsung products as “Ghana market” | **Migrate** real `products` / `vendors` / `categories` from Express Neon |
| Seed re-run to “fix” prices | Repair from source of truth or admin/vendor ops |
| Express forever dual-homed with SPA stubs | Temporary bridge only; **cut over** SPA → Medusa only |
| Paystack as afterthought provider shell | **First-class Ghana MoMo spine** (async, webhook, intents, refunds, TTL) |
| Money confusion (major vs pesewas) | Explicit boundaries: Alkemart domain = **pesewas**; Medusa GHS store amounts = **major**; Paystack API = **pesewas** |

**What we keep from work already done on `feat/medusa-production-readiness`:**  
Medusa tree, env validation, single sales-channel PK fix, SPA commerce client, `payments-ghana` intents, `paystack-client`, `ghana-checkout` API, webhook route, COD complete-cart path, platform-config money helpers.  
**What we demote:** Ghana product seed as anything other than local fixture.

---

## 1. Goals

1. **One production database platform: Neon.**  
2. **One production commerce API: Medusa** (after cutover).  
3. **Real catalog & vendors** from existing Alkemart Neon data (ETL), then live vendor/admin writes.  
4. **Production-grade Ghana Paystack MoMo** aligned with commercial spine ADRs (async, webhook, intent-before-charge, refunds, TTL).  
5. **COD** for cash-on-delivery without Paystack.  
6. **SPA** keeps UI/UX; talks only to Medusa + typed commerce layer; no Express stubs in production.  
7. **No hardcodes** for secrets, region, sales channel, keys, stock, vendors, roles.

### Non-goals (this plan)

- Multi-currency live checkout  
- Self-serve vendor KYC onboarding (admin-grant roles still OK)  
- Courier rate engines  
- Replacing Paystack with another PSP  
- Using seed as production catalog  

---

## 2. Target architecture

```
                    ┌──────────────────────┐
                    │  Cloudflare Pages    │
                    │  SPA (Alkemart UI)   │
                    │  VITE_MEDUSA_* only  │
                    └──────────┬───────────┘
                               │ HTTPS + publishable key + JWT
                               ▼
                    ┌──────────────────────┐
                    │  Medusa (Fly/etc)    │
                    │  Store + custom APIs │
                    │  ghana-checkout      │
                    │  hooks/paystack      │
                    │  jobs (TTL, outbox)  │
                    └─────┬──────────┬─────┘
                          │          │
              DATABASE_URL│          │ PAYSTACK_SECRET_KEY
                          ▼          ▼
                 ┌─────────────┐  ┌─────────────────┐
                 │ Neon PG     │  │ Paystack Ghana  │
                 │ (prod)      │  │ Charge + Webhook│
                 │ Medusa      │  │ Verify + Refund │
                 │ tables only │  └─────────────────┘
                 │ after cut   │
                 └─────────────┘
                          ▲
                          │ one-time ETL
                 ┌────────┴────────┐
                 │ Express Neon    │  freeze writes at cutover
                 │ (source tables) │  then archive API
                 └─────────────────┘
```

### 2.1 Neon layout (recommended)

| Environment | Neon object | Purpose |
|---|---|---|
| Dev | Branch `dev` or shared project | Medusa + optional Express side-by-side |
| Staging | Branch `staging` | Migration dry-run + Paystack **test** keys |
| Production | Branch `main` / prod project | Medusa only after cutover |

**Today (as-built):** Express root `.env` and Medusa `.env` both point at the **same** Neon host/db (`neondb`). That is acceptable for migration engineering **if**:

- Table namespaces don’t collide fatally (Drizzle snake plural vs Medusa module tables — verify),  
- Or we create a **dedicated Neon database/branch for Medusa** and ETL into it (cleaner).

**Decision for this plan (recommended):**

> **ADR-P1:** Production Medusa gets its **own Neon database** (or branch with isolated DB) `alkemart_medusa`. Express remains on current `neondb` until cutover complete. ETL reads Express Neon → writes Medusa Neon. Avoids MikroORM migrations thrashing Express tables.

If ops prefers one DB: document dual-schema coexistence and a freeze order. Default remains **separate Neon DB for Medusa**.

### 2.2 Money boundaries (non-negotiable)

| Layer | Unit | Example Samsung ₵1899 |
|---|---|---|
| Alkemart domain / Express / SPA `*Pesewas` | integer pesewas | `189900` |
| Medusa Store `calculated_amount` (GHS) | major units | `1899` |
| Paystack Charge/Refund `amount` (GHS) | integer pesewas | `189900` |

Conversion lives only in:

- `@workspace/platform-config` → `medusaAmountToPesewas` / `pesewasToMedusaAmount`  
- `paystack-client` → `toPaystackAmountPesewas` / `fromPaystackAmountMajor`  

Never multiply twice. Unit tests guard both directions.

---

## 3. Ghana Paystack integration (proper design)

This is the commercial heart. Port Express spine ADRs into Medusa — do not invent a second payment model.

### 3.1 Channels

| Method | Buyer UX | Provider | Order path |
|---|---|---|---|
| **MoMo** | MTN / Vodafone / AirtelTigo + phone | Paystack Charge API `mobile_money` | Async-capable |
| **COD** | Cash on delivery | Medusa `pp_system_default` | Sync complete cart |

Card can be Phase 2 later; not blocking Ghana launch.

### 3.2 Paystack Ghana MoMo state machine

```
quote cart (Medusa totals)
    │
    ▼
create payment_intent (initiated)     ← ADR-014 BEFORE any Paystack HTTP
    │   client_reference = UUID
    │   amount_pesewas, cart_id, expires_at
    ▼
POST api.paystack.co/charge
    mobile_money: { phone, provider: mtn|vod|atl }
    amount: pesewas
    currency: GHS
    metadata: { payment_intent_id, client_reference, cart_id }
    │
    ├─ success (sandbox often) ──► verify amount ──► confirmPaid ──► completeCart
    ├─ pending | send_otp | pay_offline ──► attach provider_reference
    │         │                              return 202 payment_pending
    │         ├─ webhook charge.success ──► confirmPaid (idempotent)
    │         ├─ buyer poll / refresh ──► verify API ──► confirmPaid
    │         └─ TTL expire ──► markExpired, unlock cart, NO order
    └─ declined ──► markFailed, no order
```

### 3.3 Provider slug map (Ghana)

| UI / domain | Paystack `mobile_money.provider` |
|---|---|
| `mtn` | `mtn` |
| `vodafone` | `vod` |
| `airteltigo` | `atl` |

(Already correct in Express `paystack.ts` and Medusa `paystack-client`.)

### 3.4 Intent model (`payments-ghana`) — already scaffolded

| Field | Role |
|---|---|
| `client_reference` | Unique UUID before HTTP; join key if crash mid-charge |
| `provider_reference` | Paystack reference after charge response |
| `amount_pesewas` | Charged total invariant |
| `status` | initiated → pending → succeeded \| failed \| expired |
| `cart_id` / `order_id` | Link to Medusa cart then order |
| `expires_at` | TTL (default 30 min from env) |

**Idempotency:**  
- Unique `client_reference`  
- Unique `provider_reference` where not null  
- `confirmPaid` is no-op if already `succeeded` + `order_id` set  
- Webhook always returns 200 after valid signature processing  

### 3.5 confirmPaid invariants

1. Resolve intent by `provider_reference` **or** metadata `payment_intent_id` / `client_reference`.  
2. `verify` transaction with Paystack (never trust webhook body alone for amount).  
3. `Paystack.amount (pesewas) === intent.amount_pesewas` else **refund + fail**.  
4. Currency `GHS`.  
5. Complete Medusa cart → order (`completeCartWorkflow`).  
6. Persist `order_id` on intent; append ledger/metadata.  
7. If complete fails after capture → **refund** + mark failed + ops alert.

### 3.6 Inventory during MoMo (align ADR-011)

Current pragmatic v1 (as implemented): complete cart only after pay → Medusa inventory decrements at complete.  

**Production target (stronger):**

| Phase | Inventory |
|---|---|
| MoMo pending | **Reserve** inventory (Medusa reservation or soft cart lock + inventory reservation API) |
| Confirm | Convert reservation → sold via complete cart |
| TTL / fail | Release reservation; cart remains for retry |

**ADR-P2:** Implement inventory **reservation** on `payment_pending` before charging when Medusa APIs allow; if not, document risk of oversell between pending and confirm and mitigate with short TTL (30m) + stock check at confirm.

### 3.7 Webhooks

| Item | Spec |
|---|---|
| URL | `https://api.<domain>/hooks/paystack` |
| Auth | HMAC-SHA512 of **raw body** with `PAYSTACK_SECRET_KEY` (not a separate webhook secret) |
| Events | **Required:** `charge.success`. Log others. |
| Body | Preserve raw body middleware (already `middlewares.ts`) |
| Response | 401 invalid signature; 200 `{ received: true }` after handle |

Register URL in Paystack dashboard for **test** then **live**.

### 3.8 Refunds & cancel

| Case | Action |
|---|---|
| Capture then complete fails | Auto refund full intent amount |
| Cancel unpaid pending | Expire intent; release hold; no refund |
| Cancel paid unfulfilled | Paystack refund + restock + ledger |
| Cancel after ship | Reject (buyer dispute flow) |

### 3.9 Env (Paystack + Neon)

```bash
# Neon
DATABASE_URL=postgresql://...@...neon.tech/alkemart_medusa?sslmode=require
# prefer pooled URL for Medusa runtime if Neon provides one

# Paystack (Ghana)
PAYSTACK_SECRET_KEY=sk_live_...   # or sk_test_ for staging
PAYSTACK_PUBLIC_KEY=pk_live_...   # SPA only if needed for JS; MoMo charge is server-side
# Webhook uses SECRET_KEY for HMAC — no PAYSTACK_WEBHOOK_SECRET

# Commerce context (from bootstrap, not hardcode)
ALKEMART_REGION_ID=reg_...
ALKEMART_SALES_CHANNEL_ID=sc_...
PAYMENT_PENDING_TTL_MINUTES=30

# SPA
VITE_MEDUSA_BACKEND_URL=https://api...
VITE_MEDUSA_PUBLISHABLE_KEY=pk_...
VITE_MEDUSA_REGION_ID=reg_...
VITE_MEDUSA_SALES_CHANNEL_ID=sc_...
```

Production boot **fails** without secrets (already partially in `loadAppEnv`).

### 3.10 What already exists vs remaining Paystack work

| Piece | Status | Remaining |
|---|---|---|
| `paystack-client` HMAC, amount convert, charge MoMo, refund, verify | Done | Live E2E with test keys |
| `payments-ghana` intents module + migration | Done | Reservation fields if needed |
| `ghana-checkout` COD + MoMo paths | Done (COD smoke) | Inventory reserve; promo revalidate |
| `POST /hooks/paystack` | Done | Dashboard URL + live test |
| TTL job | Done | Alerting on poison |
| SPA `useGhanaCheckout` | Done | Pending UX polish; order detail pending poll |
| Medusa Payment Provider registration | Conditional on secret | Wire region payment providers to Paystack if using sessions path |
| Settlements Transfer API | Express partial | Phase after launch |

---

## 4. Real data strategy (no production seed)

### 4.1 Source of truth phases

| Phase | Truth | Writers |
|---|---|---|
| **Now** | Express Drizzle tables on Neon | Express API (if running), scripts |
| **Migration window** | Express read-only freeze for catalog/orders | ETL job only |
| **Post-cutover** | Medusa tables on Neon Medusa DB | Medusa admin + vendor APIs + SPA |

### 4.2 ETL modules (build once, re-runnable)

Script package: `alkemart-medusa/apps/backend/src/scripts/migrate-from-express/`

| Job | Source | Target | Idempotency key |
|---|---|---|---|
| `01-bootstrap-context.ts` | config | region GHS, SC, stock location, shipping GH, publishable key | name/handle |
| `02-categories.ts` | `categories` | Medusa product categories | `slug` → handle |
| `03-vendors.ts` | `vendors` | marketplace Vendor | `slug` |
| `04-products.ts` | `products` + images | product + variant + price + inventory + SC + vendor link | `slug` → handle |
| `05-customers.ts` | `users` buyers | Medusa customers | email |
| `06-homepage.ts` | `homepage_sections` | homepage module or JSON | id/sort |
| `07-open-orders.ts` | optional | **Prefer drain on Express** | — |

**Product mapping:**

```
Express.product.pricePesewas  → Medusa variant price amount = pesewasToMedusaAmount(pricePesewas)
Express.product.stock         → inventory level at Accra location
Express.product.vendorId      → vendor-product link
Express.product.categoryId    → category_ids
Express.product.slug          → handle
```

**Skip / archive seed:**

- `seed-ghana.ts` → rename/doc as `fixtures/dev-seed-ghana.ts`, guard:

```ts
if (process.env.NODE_ENV === "production") {
  throw new Error("Dev seed refused in production")
}
```

### 4.3 Cutover checklist (data)

1. Count Express rows: vendors, active products, open orders, pending payments.  
2. Dry-run ETL on Neon **staging branch**.  
3. Diff spot-check 20 products (price, stock, vendor).  
4. Freeze Express catalog/checkout writes.  
5. Final ETL delta.  
6. Point SPA to Medusa prod.  
7. Drain remaining Express MoMo pendings **before** freeze if any.  
8. Keep Express DB read-only 30 days for reconciliation.

---

## 5. Backend modules (production map)

| Module / area | Responsibility | Neon tables |
|---|---|---|
| Medusa core | product, cart, order, customer, inventory, region | Medusa core |
| `marketplace` | multi-vendor ownership | vendor, vendor_staff + links |
| `payments-ghana` | intents, TTL, amount ledger metadata | payment_intent |
| `paystack` provider + client | charge/verify/refund/HMAC | external |
| `settlements` (next) | vendor payout periods | settlement* |
| `disputes` / `homepage` / messaging | Ghana extras | custom |
| Jobs | intent TTL, outbox, orphan intent recovery | — |

Express remains **reference implementation** for algorithm fidelity until port complete, then archived.

---

## 6. SPA construction rules

1. Single `createMedusaClient()` + `commerceContext` from env only.  
2. Domain types with `*Pesewas` and `variantId`.  
3. Checkout → `POST /store/ghana-checkout` only (already wired).  
4. Production build fails without `VITE_MEDUSA_*`.  
5. `api-stubs` must not ship in production bundle (tree-shake or delete after port).  
6. Honest empty states — never invent prices/products.

---

## 7. Execution phases (reordered for real production)

```
P0  Foundations & Neon layout
P1  Bootstrap commerce context (no catalog seed)
P2  Paystack Ghana production path (test keys → E2E)
P3  ETL real catalog/vendors from Express Neon
P4  Inventory reservation + cancel compensation harden
P5  SPA production paths (orders, kill stubs)
P6  Settlements + ops
P7  Cutover + deploy
```

### P0 — Foundations & Neon layout

- [ ] Create Neon database/branch `alkemart_medusa` (or document single-DB dual-schema choice)  
- [ ] Point Medusa `DATABASE_URL` at Medusa Neon; keep Express URL on legacy until cutover  
- [ ] Redis managed (Upstash/etc) for prod Medusa  
- [ ] Secrets: strong JWT/COOKIE; no `supersecret`  
- [ ] Document connection: prefer Neon **pooled** URL for Medusa runtime  

**DoD:** Medusa migrates cleanly on empty Medusa Neon; Express data untouched.

### P1 — Bootstrap commerce context (infrastructure only)

- [ ] Script `bootstrap-commerce-context.ts`:  
  Ghana region, Alkemart Storefront SC, single PK link, stock location Accra, shipping option GH, tax if needed  
- [ ] Prints IDs into env template — **zero products**  
- [ ] `seed-ghana` product catalog → dev-only fixture with production guard  

**DoD:** Cart create works on empty catalog; store list empty honestly.

### P2 — Paystack Ghana (proper)

- [ ] Staging: `sk_test_`, public key, webhook → staging Medusa URL  
- [ ] E2E matrix:

| Case | Expected |
|---|---|
| MoMo sync success (test) | 200 completed + order |
| MoMo pending → webhook | 202 then order after webhook |
| Amount mismatch | refund, no order |
| Invalid signature | 401 |
| Double webhook | one order |
| TTL expire | no order, cart retryable |
| COD | order without Paystack |

- [ ] Confirm amount path: cart major → pesewas intent → Paystack pesewas → verify  
- [ ] Orphan recovery job: intents `initiated` with no reference after N minutes → verify/refund  
- [ ] SPA: pending MoMo poll optional `POST /store/ghana-checkout/refresh`  

**DoD:** Sign-off on test matrix in staging Neon + Paystack test mode.

### P3 — ETL real data

- [ ] Implement migrate jobs 01–06 (§4.2)  
- [ ] Dry-run on staging; report row counts + sample diffs  
- [ ] Vendor–product links required for storefront “sold by”  
- [ ] Prices: assert sample product display GH₵ matches Express pesewas/100  

**DoD:** Staging SPA shows **real** Alkemart catalog from migration, not seed.

### P4 — Harden commercial spine

- [ ] Inventory reservation on MoMo pending (or accept documented oversell window)  
- [ ] Cancel matrix (unpaid / paid unshipped)  
- [ ] Promo revalidate at confirm if promos used  
- [ ] Outbox for `order.placed` notifications  

### P5 — SPA production surfaces

- [ ] Orders list/detail aligned to Medusa + pending payment state  
- [ ] Addresses fully Medusa (done partially)  
- [ ] Remove production imports of `api-stubs`  
- [ ] Typecheck green for buyer paths  

### P6 — Settlements & vendor

- [ ] Port settlement generate/mark-paid against Medusa orders  
- [ ] Vendor dashboard via marketplace + Medusa orders  

### P7 — Cutover & deploy

- [ ] Fly/Railway Medusa + Cloudflare SPA  
- [ ] Paystack live keys + live webhook URL  
- [ ] Neon prod DB; backups enabled  
- [ ] Rewrite `DEPLOYMENT.md` (Medusa-centric)  
- [ ] Freeze Express write traffic; final ETL; switch DNS/env  
- [ ] Monitor: payment intents, webhook 5xx, Neon connections  

---

## 8. Paystack Ghana — implementation checklist (detailed)

### 8.1 Charge request (server)

```http
POST https://api.paystack.co/charge
Authorization: Bearer sk_...
Content-Type: application/json

{
  "amount": 189900,
  "email": "buyer@example.com",
  "currency": "GHS",
  "mobile_money": {
    "phone": "0244123456",
    "provider": "mtn"
  },
  "metadata": {
    "payment_intent_id": "payint_...",
    "client_reference": "uuid-...",
    "cart_id": "cart_..."
  }
}
```

### 8.2 Response handling

| `data.status` | Action |
|---|---|
| `success` | attach ref → confirmPaid |
| `pending`, `send_otp`, `pay_offline` | attach ref → 202 pending |
| other / error | markFailed → 402 |

### 8.3 Webhook

```http
POST /hooks/paystack
x-paystack-signature: <hmac sha512 hex of raw body>
```

### 8.4 SPA contract (stable)

```
POST /store/ghana-checkout
{ cart_id, payment_method: "cod"|"momo", email?, phone?, momo_provider? }

200 { status: "completed", order_id, cart_id }
202 { status: "payment_pending", payment_intent_id, provider_reference, expires_at, amount_pesewas, ... }
4xx { error }
```

---

## 9. Testing strategy

| Layer | Coverage |
|---|---|
| Unit | amount convert, HMAC, provider slugs, amount match assert |
| Integration | intent create → mock Paystack → confirm → order |
| Staging E2E | real Paystack test MoMo phones if available |
| Migration | count + sample price/stock/vendor |
| Load | webhook idempotency under retry |

Port Express `checkout-promo-race` spirit once promos on Medusa.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Same Neon DB for Express+Medusa | Prefer separate Medusa DB (ADR-P1) |
| Seed pollution of prod | Production seed guard; ETL only |
| MoMo oversell without reservation | Short TTL + stock check at confirm; then reserve |
| Double conversion major/pesewas | Single conversion helpers + tests |
| Neon connection limits | Pooler URL; one migrate at a time |
| Webhook downtime | verify poll + recovery job |
| Open Express orders at cutover | Drain policy; don’t half-migrate paid state |

---

## 11. Relationship to prior work

| Prior artifact | Role now |
|---|---|
| `feat/medusa-production-readiness` commits | Plumbing foundation — keep |
| `seed-ghana.ts` | Dev fixture only |
| Express `paystack.ts` / webhooks / checkout | Spec for behavior port |
| Commercial spine ADRs | Payment law |
| This document | **Production execution plan** |

---

## 12. Immediate next execution (when you say go)

1. **P0** Neon Medusa database + re-point Medusa `DATABASE_URL` + migrate  
2. **P1** bootstrap context without products  
3. **P2** Paystack test-key E2E matrix  
4. **P3** ETL categories → vendors → products from Express Neon  

Do **not** expand seed catalog. Do **not** treat demo products as market.

---

## 13. Success criteria (production ready)

- [ ] Neon hosts Medusa prod data  
- [ ] Catalog = migrated real vendors/products (spot-checked)  
- [ ] Zero production dependency on seed  
- [ ] MoMo test matrix green; live keys configured  
- [ ] Webhook verified in Paystack dashboard  
- [ ] COD + MoMo complete buyer journeys on SPA  
- [ ] Express not required for SPA  
- [ ] Deploy docs match Medusa + Neon + Paystack  
- [ ] Secrets/CORS/Redis production-grade  

---

## 14. Explicit answer: Paystack for Ghana

**Yes — this plan centers Ghana Paystack MoMo** as the primary paid checkout:

- Charge API + provider slug map (MTN/Vod/ATL)  
- Async pending + USSD/prompt  
- Webhook `charge.success` + verify  
- Intent-before-charge (crash-safe)  
- Amount invariant in pesewas  
- Refunds on failure paths  
- TTL abandon  
- COD without Paystack  

That is the same design Express commercial spine already specified — now as the Medusa production payment path on Neon.
