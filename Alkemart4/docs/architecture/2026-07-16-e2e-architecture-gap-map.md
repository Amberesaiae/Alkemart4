# E2E architecture gap map — Alkemart clean slate

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Method** | Code inventory + live HTTP probes against running API `:9000` + SPA `:5175` |
| **Runtime API** | `/home/amber/alkemart-backend` (Mercur/Medusa) |
| **Repo SPA** | `artifacts/alkemart` |
| **Repo API source** | `apps/backend` (must stay in sync with Linux worktree) |
| **Supersedes for honesty** | Partial matrices in `2026-07-16-e2e-wiring-status.md` and `2026-07-16-live-e2e-workflow-audit.md` (those understated remaining surface) |

---

## One-sentence truth

**Platform spine + one COD purchase path work. Most buyer post-purchase, MoMo money spine, catalog depth, and Express-era features are not ported or not wired.**

```text
DONE enough for demo COD:
  Browse 1 product → offer cart → address → seller-keyed ship → ghana-checkout COD → order id

NOT done for production Ghana marketplace:
  MoMo async + Paystack + webhooks + cancel/refund + settlements + dense catalog
  + store pages + categories + order detail fidelity + support/password + multi-vendor split
```

---

## Target architecture (locked)

```text
┌──────────────────────┐     store API only      ┌─────────────────────────────┐
│ artifacts/alkemart   │ ───────────────────────►│ apps/backend (Mercur) :9000 │
│ BUYER SPA            │                         │ + /dashboard  ADMIN         │
│ browse cart checkout │                         │ + /seller     VENDOR        │
│ account orders       │                         │ + thin Alkemart adapters    │
└──────────────────────┘                         └──────────────┬──────────────┘
                                                                │
                                                   Neon alkemart_marketplace
                                                   Paystack (when keys + MoMo path)
```

| Actor | Canonical UI | Canonical write path |
|-------|--------------|----------------------|
| Buyer | SPA `:5175` | Medusa store + `POST /store/ghana-checkout` |
| Seller | Mercur `/seller` (or Vite `:7001`) | Mercur vendor APIs |
| Admin | Mercur `/dashboard` (or Vite `:7000`) | Mercur admin APIs |
| Express | **Off** (`:5000` down) | Reference only (`artifacts/api-server`) |

---

## Status legend

| Tag | Meaning |
|-----|---------|
| **GREEN** | Live-proved or code+runtime consistent |
| **YELLOW** | Partial: works with caveats or UI/API mismatch |
| **RED** | Broken, 404, stub-only, or commercial gap |
| **OUT** | Intentionally out of SPA (Mercur / later) |

---

## Layer 0 — Runtime spine

| ID | Boundary | Status | Evidence (2026-07-16) |
|----|----------|--------|------------------------|
| R1 | Medusa/Mercur API health | **GREEN** | `GET /health` → `OK` |
| R2 | Neon marketplace DB | **GREEN** | Connected via worktree `.env` |
| R3 | SPA Vite shell | **GREEN** | `:5175` HTTP 200 |
| R4 | Mercur admin panel | **GREEN** | `:9000/dashboard` + `:7000` 200 |
| R5 | Mercur seller panel | **GREEN** | `:9000/seller` + `:7001` 200 |
| R6 | Express runtime | **GREEN (absent)** | `:5000` down — good |
| R7 | Dual worktree discipline | **YELLOW** | Live API = `/home/amber/alkemart-backend`; git source = `apps/backend`. Edits can diverge. `ghana-checkout` currently matches; no automated sync gate. |
| R8 | SPA Vite `/api` proxy | **YELLOW** | Still proxies `/api` → `:8080` (Express). Buyer stubs still call `/api/*`. Production must not depend on this. |
| R9 | Redis / workers | **YELLOW** | Not re-probed this session; jobs required for production MoMo webhooks/outbox later |

---

## Layer 1 — Commerce config (Ghana)

| ID | Boundary | Status | Evidence |
|----|----------|--------|----------|
| C1 | Region Ghana / GHS | **GREEN** | SPA `VITE_MEDUSA_REGION_ID=reg_01KXMNJCTK…` |
| C2 | Sales channel + publishable key | **GREEN** | Products list with SPA key works |
| C3 | Stock location / shipping profile | **GREEN** | Seller shipping option exists |
| C4 | Payment providers on region | **YELLOW** | Store lists **only** `pp_system_default`. No `pp_paystack` in region. |
| C5 | Paystack module code | **YELLOW** | `packages/api/src/modules/paystack/*` ported; registered only if `PAYSTACK_SECRET_KEY` set |
| C6 | `PAYSTACK_SECRET_KEY` in live env | **RED** | Not present on running worktree `.env` → MoMo 503 path |
| C7 | Product categories | **RED** | `GET /store/product-categories` → **count 0**. Browse-by-department cannot be API-driven. |
| C8 | Catalog density | **YELLOW** | **1** published store product (`Golden Palm Cooking Oil 1L`, offer `offer_01KXN9KW…`, GHS 45). Two sellers exist; only Tema offer store-visible. |

---

## Layer 2 — Buyer journey (SPA × API)

### 2A Happy path (purchase)

| ID | Step | SPA surface | Backend | Status | Notes |
|----|------|-------------|---------|--------|-------|
| B1 | Home | `/` | products list + **static** `DEFAULT_HOMEPAGE_SECTIONS` | **YELLOW** | UI Ghana redesign lives; homepage CMS **not** on Medusa — hardcoded fallback sections |
| B2 | Browse all / search | `/browse/$slug` | `sdk.store.product.list` | **YELLOW** | Works for list; category_id filter useless with 0 categories; department nav fallback tiles |
| B3 | PDP | `/ip/$id` | product retrieve + `offer_id` on variants | **GREEN** | Offer id mapping in `hooks-products` / `hooks-cart` |
| B4 | Add to cart | cart hooks | `POST …/line-items` with **`offer_id`** | **GREEN** | Live: total GHS 45 |
| B5 | Cart UI | `/cart` | cart retrieve/update/delete lines | **GREEN** | Medusa SDK |
| B6 | Sign up | `/signin/create` | register → create customer → login | **YELLOW** | Code path correct; registration JWT has **empty `actor_id`** until customer create + re-login (SPA does this) |
| B7 | Sign in | `/signin` | emailpass login | **GREEN** | After customer exists, JWT has `actor_id=cus_…` |
| B8 | Session / me | `useGetMe` / `requireAuth` | **`GET /store/alkemart/me`** | **GREEN** (2026-07-16 P0) | Live: authed **200** `{ user, roles: buyer }`; unauth **401**. Fallback still present |
| B9 | Saved addresses | `/account/addresses` | Medusa customer addresses | **GREEN** (code) | SDK create/list/update/delete |
| B10 | Checkout address | `/checkout` | cart `shipping_address` update | **GREEN** | Live city Tema |
| B11 | Shipping options | `prepareCartForCheckout` | `GET /store/shipping-options?cart_id=` | **GREEN** | Mercur returns **seller-keyed map** `{ sel_…: [so_…] }`; `flattenShippingOptions` handles it; attach works (ship +15) |
| B12 | Fulfillment UI picker | checkout | static labels | **YELLOW** | `FulfillmentPicker` defaults are honest placeholders — **not** bound to live shipping options list |
| B13 | COD place order | `useGhanaCheckout` | `POST /store/ghana-checkout` method `cod` | **GREEN** | Live order `order_01KXNZ25YFCKYG4S85A9DN6MJE` accounting total 60 |
| B14 | MoMo place order | same | `runMomoCheckout` + charge + webhook | **YELLOW** (P1 code) | No key → **503** honest. With `PAYSTACK_SECRET_KEY`: charge-before-commit, 202 pending, poll `/status`, webhook `/hooks/paystack` completes cart. Live charge needs real keys |
| B15 | Checkout → order page | navigate on success | order id from response | **YELLOW** | COD returns `order_id`; customer-linked cart → orders list **GREEN** (count 1 after transfer) |

### 2B Post-purchase & account

| ID | Step | SPA surface | Backend | Status | Notes |
|----|------|-------------|---------|--------|-------|
| B16 | Orders list | `/orders` | `sdk.store.order.list` | **GREEN** (P0) | After `transferCart` + COD, list returns order. Guest-only COD still won’t attach |
| B17 | Order detail | `/order/$id` | Medusa mapper + UI | **GREEN** (P0) | Mapper fills address, paymentMethod, fulfillments, shipping totals; cancel/dispute → honest email support |
| B18 | Cancel order | order detail | mailto support | **YELLOW** | Honest “request cancel” — no Medusa cancel compensation yet |
| B19 | Dispute | order detail | mailto support | **YELLOW** | Honest email path |
| B20 | Support chat | `/support` | mailto support | **YELLOW** | In-app chat removed; email CTA |
| B21 | Forgot / reset password | `/signin/forgot`, `/reset` | honest error | **YELLOW** | Clear error until Medusa password reset ported |
| B22 | Change password | account | honest error | **YELLOW** | Same |
| B23 | Profile update | account | Medusa customer update | **GREEN** (code) | |
| B24 | Payment methods page | `/account/payments` | static copy | **YELLOW** | Honest static MoMo/COD explainer; no saved instruments (OK for Ghana MoMo-at-checkout) |
| B25 | Lists / wishlist | `/account/lists` | none | **RED / OUT** | "Coming soon" placeholder |
| B26 | Store by slug | `/store/$slug` | **`GET /store/alkemart/vendors/:slug`** | **GREEN** (P0) | Live **200** Tema Fresh Goods by handle |

### 2C SPA architecture (unclog)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| U1 | SPA `/admin/*` routes | **GREEN** | Hard-deleted; routeTree buyer-only |
| U2 | SPA `/vendor/*` routes | **GREEN** | Hard-deleted |
| U3 | Ops flags default off | **GREEN** | `VITE_OPS_BACKEND=off` |
| U4 | Mercur external links | **GREEN** | Account menu → seller/admin hubs |
| U5 | `api-stubs` dual-home bulk | **YELLOW** | Slimmed to buyer leftovers (~200 lines); still **runtime-broken** without Express |
| U6 | Dual-home honesty | **GREEN** | Architecture ADR accepted |

---

## Layer 3 — Seller / vendor journey (Mercur)

| ID | Workflow | Status | Evidence / gap |
|----|----------|--------|----------------|
| S1 | Seller UI shell | **GREEN** | `/seller` 200 |
| S2 | Member auth + seller actor | **GREEN** | Prior: `member.tema@…` + `x-seller-id` |
| S3 | Admin list sellers | **GREEN** | Live: 2 sellers (`accra-market`, `tema-fresh`) |
| S4 | Product request → confirm → offer | **GREEN** | Prior runbook: Golden Palm visible with offer |
| S5 | Seller shipping option for zone | **GREEN** | `so_01KXNCP…` Standard delivery GH |
| S6 | Multi-seller cart split | **RED / untested** | Only one offer in store; split cart + multi shipping methods not E2E’d |
| S7 | Vendor fulfill after order | **YELLOW / untested** | Mercur has modules; no live fulfill probe after COD order |
| S8 | Commission / settlement | **RED** | Commercial spine: columns/intent exist historically; **no** payout ledger or Transfer path on clean slate |
| S9 | SPA vendor dual-home | **OUT** | Correctly removed |

---

## Layer 4 — Admin journey (Mercur)

| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| A1 | Admin login superuser | **GREEN** | `admin@alkemart.local` |
| A2 | Dashboard shell | **GREEN** | |
| A3 | Approve sellers / product requests | **GREEN** (prior) | Runbook documented |
| A4 | Homepage CMS | **RED / OUT of Medusa** | SPA uses static fallback; no Medusa homepage sections API |
| A5 | Promotions engine | **RED / untested** | SPA promo field exists; no proven promo on clean slate |
| A6 | SPA admin dual-home | **OUT** | Removed |

---

## Layer 5 — Commercial spine (money) — against ADR 2026-07-13

| ID | Capability | Express reference | Clean-slate Medusa | Status |
|----|------------|-------------------|--------------------|--------|
| M1 | COD order commit | Express checkout | `ghana-checkout` + system payment + `completeCartWorkflow` | **GREEN** (live) |
| M2 | MoMo charge (sync sandbox) | `paystack.ts` charge | `chargeMobileMoney` in `runMomoCheckout` | **YELLOW** — code live; needs keys for E2E |
| M3 | MoMo async (OTP / pending) | payment intents + webhooks | Cart metadata intent + 202 + poll status | **YELLOW** — cart metadata stand-in for payments-ghana table |
| M4 | Paystack webhook HMAC | Express webhooks | `POST /hooks/paystack` + re-verify via API | **YELLOW** — wired; set dashboard URL + secret |
| M5 | Payment intents ledger | Express schema | Cart `metadata` keys (`paystack_reference`, amounts) | **YELLOW** — not a dedicated table yet |
| M6 | Cancel + stock restore + refund | Express incomplete | Stubs only / not ported | **RED** |
| M7 | Vendor settlements / payouts | Express partial | Not ported | **RED** |
| M8 | Transactional outbox | Express target | Not ported | **RED** |
| M9 | Pesewas / major-unit conversion | Express + platform-config | Paystack module documents major↔pesewas | **YELLOW** (code only) |
| M10 | Charge-before-commit MoMo | Express ADR | MoMo path 503 — not enforceable yet | **RED** |

---

## Layer 6 — Custom Alkemart adapters on Mercur (inventory)

**What exists on live API tree (`packages/api/src`):**

| Path | Role | Status |
|------|------|--------|
| `api/store/ghana-checkout/route.ts` | Buyer payment entry | **GREEN** COD / **RED** MoMo |
| `lib/ghana-checkout.ts` | COD orchestration | **GREEN** |
| `modules/paystack/*` + `lib/paystack-client.ts` | Payment provider | **YELLOW** code only |
| `api/store/custom/route.ts` | Placeholder | unknown utility |
| `api/admin/custom/route.ts` | Placeholder | unknown utility |

**What SPA still calls but API does not serve:**

| SPA call | Live result |
|----------|-------------|
| `GET /store/alkemart/me` | **200** (auth) / **401** (guest) |
| `GET /store/alkemart/vendors/:slug` | **200** for open sellers |
| `GET/POST /api/*` (stubs) | Removed from active UI; honest errors only |

Clean-slate ADR said dual-home `/store/alkemart/*` should **not** be long-term — but SPA still depends on those shapes with weak fallbacks. Decision needed: either implement thin adapters or delete SPA calls entirely.

---

## Layer 7 — Per-route SPA wiring matrix

| Route | Data source | Live E2E |
|-------|-------------|----------|
| `/` | Static sections + Medusa products | **YELLOW** — products OK, CMS fake |
| `/browse/$slug` | Medusa products | **YELLOW** — no categories |
| `/ip/$id` | Medusa product | **GREEN** |
| `/cart` | Medusa cart | **GREEN** |
| `/checkout` | Medusa cart + ghana-checkout | **YELLOW** — COD green API; SPA browser E2E not headed; MoMo red; shipping picker cosmetic |
| `/orders` | Medusa orders | **YELLOW** — needs customer-linked order |
| `/order/$id` | Medusa order + Express-shaped UI | **RED** mismatch |
| `/account` | Medusa customer + Express password | **YELLOW** |
| `/account/addresses` | Medusa | **GREEN** (code) |
| `/account/payments` | Static | OK explainer |
| `/account/lists` | None | **RED** placeholder |
| `/store/$slug` | Missing alkemart vendor API | **RED** |
| `/support` | Express stubs | **RED** |
| `/signin/*` | Medusa auth + Express forgot/reset | **YELLOW** login/signup green; forgot/reset red |
| `/help`, `/terms`, `/privacy` | Static content | **GREEN** (content) |

---

## End-to-end story scoreboard

| User story | Score | Blocker |
|------------|-------|---------|
| Buyer browses Ghana catalog | **40%** | 1 product, 0 categories, static homepage |
| Buyer adds offer to cart | **90%** | Works |
| Buyer checks out COD | **75%** | API green; SPA fulfillment UI not real options; order confirmation UI weak |
| Buyer pays MoMo | **5%** | 503 + no keys + no async/webhook |
| Buyer sees order history / detail | **30%** | List API OK; detail still Express-shaped; cancel/dispute dead |
| Buyer messages support | **0%** | Express stub |
| Seller lists product | **80%** | Proven once via Mercur; not automated |
| Seller fulfills order | **?/** untested | |
| Admin operates marketplace | **70%** | Panels up; CMS/promos/settlements not clean-slate |
| Multi-vendor cart | **0%** | Untested / insufficient catalog |
| Production deploy readiness | **25%** | Worktree drift, no MoMo spine, thin catalog, stub debt |

**Overall production readiness: ~40–45%** (P0 session lifted session/store/order surfaces).  
**Overall “demo COD buy once”: ~85%** (customer-linked order + me + vendor store).  
Still blocking production: MoMo/Paystack, categories density, cancel compensation, settlements.

---

## Critical path backlog (ordered)

### P0 — Broken truths the SPA already assumes

1. **Resolve `/store/alkemart/me`** — either implement thin store route (roles + user) or remove call and rely only on `customer.retrieve` + fixed buyer ability.
2. **Fix order detail model** — map Medusa order → UI fields (`shipping_address`, payment collection, fulfillments) or simplify order page to Medusa fields only.
3. **Link COD carts to customer** when logged in so `/orders` shows purchases.
4. **Store page** — use Mercur storefront seller handle or drop route until adapter exists.

### P1 — Money (Ghana launch)

5. Set `PAYSTACK_SECRET_KEY` (+ public key) on API worktree; register provider on Ghana region.
6. Implement `runMomoCheckout` → Paystack charge/pending + return `payment_pending` to SPA.
7. Webhook route + signature verify + complete cart / mark paid.
8. Cancel matrix: unfulfilled → restore + refund rules (commercial spine ADR).

### P2 — Catalog & marketplace realism

9. Categories + attach products; denser seller catalog via Seller Hub.
10. Bind checkout fulfillment picker to `listCartShippingOptions` (not static placeholders).
11. Multi-seller cart + multi shipping method smoke.
12. Vendor fulfill path after COD order (headed Mercur).

### P3 — Kill Express leftovers

13. Password change/forgot/reset via Medusa.
14. Support: Medusa notes, external helpdesk, or honest “email us” until ported.
15. Remove Vite `/api` proxy once stubs gone.
16. Delete remaining `api-stubs` / `api-extra` callers.

### P4 — Ops hygiene

17. Single backend worktree workflow (sync script or develop only on Linux tree).
18. Seed script for Ghana demo catalog (idempotent).
19. Automated smoke script (products → cart → ship → COD) in CI.

---

## Live probe appendix (2026-07-16)

```text
GET /health                                          → OK
GET /store/products?region_id=…                      → count 1, offer_01KXN9KW…, GHS 45
GET /store/product-categories                        → count 0
GET /store/payment-providers?region_id=…             → [pp_system_default] only
GET /store/alkemart/me                               → 404
GET /store/alkemart/vendors/tema-fresh                → 404
POST /auth/customer/emailpass/register               → token, actor_id empty
POST /store/customers + re-login                     → actor_id = cus_…
GET /store/orders (authed)                           → 200 []
POST cart + offer + address + shipping + ghana COD   → order_01KXNZ25… HTTP 200
POST ghana-checkout momo                             → 503 PAYSTACK_SECRET_KEY
Express :5000                                        → down
Admin sellers                                        → 2 (accra-market, tema-fresh)
```

---

## Doc relationship

| Doc | Role after this map |
|-----|---------------------|
| This file | **Canonical gap matrix** for E2E / architecture honesty |
| `2026-07-16-unclog-architecture.md` | SPA dual-home decision (done for routes) |
| `2026-07-16-e2e-wiring-status.md` | Short status; update pointers only |
| `2026-07-16-live-e2e-workflow-audit.md` | Early audit; **stale** on catalog/checkout green claims |
| `express-port-inventory.md` | Still valid port backlog |
| `2026-07-13-…-commercial-spine.md` | Money invariants still binding |
| `2026-07-16-mercur-vendor-rbac-catalog-runbook.md` | Seller list path |

---

## Success criteria for “E2E done”

A release is **E2E complete** only when all of:

1. Buyer SPA: register → browse ≥N products/categories → offer cart → real shipping choice → **MoMo pending→paid** or COD → order list + accurate detail.  
2. No production dependency on Express `/api` or missing `/store/alkemart/*`.  
3. Seller: list → approve → offer → buyer sees → seller fulfills.  
4. Paystack webhook path verified in test mode.  
5. Single known backend worktree for deploy.
