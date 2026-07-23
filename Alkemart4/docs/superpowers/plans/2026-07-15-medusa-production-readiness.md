# Alkemart Medusa Production Readiness — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Do not skip Phase 0.** Dual Medusa trees and dual backends are the root of current failure.

**Goal:** Ship a single production-grade Alkemart stack where Medusa v2 owns commodity commerce, custom Medusa modules/workflows own Ghana multi-vendor commercial spine (Paystack MoMo async, settlements, disputes, outbox), and the existing SPA UI/UX remains fully wired with typed contracts, zero fake commerce, and zero magic hardcodes.

**Architecture:**  
**Backend-first, ACID-first.** Medusa (MikroORM + workflows) is the system of record for catalog, cart, order, inventory, customer auth. Alkemart’s proven commercial-spine ADRs (charge durability, reserved stock, webhook idempotency, settlement ledger, transactional outbox) are **ported into Medusa workflows/modules**, not left half-implemented on a dead Express process. The SPA talks only to Medusa (store + admin + custom routes) through one SDK client and a thin typed domain layer. Express becomes a reference library for porting logic, then is archived.

**Tech stack:** Medusa 2.17.2, Neon Postgres, Redis, `@medusajs/js-sdk`, React 19 + TanStack Router/Query, CASL abilities (adapted), Paystack MoMo, integer pesewas money, Fly/Railway (API) + Cloudflare Pages (SPA).

**Non-negotiable invariants (from `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md`):**

| ID | Invariant |
|---|---|
| ADR-002 | All money is **integer pesewas** end-to-end; format only at display |
| ADR-003/011 | Pending MoMo holds `reservedStock` only; confirm converts hold → sold |
| ADR-005 | Append-only payment events; **idempotency on payment_intents** |
| ADR-008 | Webhook-driven MoMo confirm + verify fallback + 30m TTL |
| ADR-010 | Domain events via **transactional outbox** (same TX as business write) |
| ADR-012/013 | Side effects deferred until paid; promo revalidated under row lock at confirm |
| ADR-014 | Intent + `clientReference` **before** Paystack HTTP; required charge metadata |
| UX-0 | Never invent prices/products/ratings; skeleton or honest empty only |
| CFG-0 | No hardcodes for URLs, keys, sales channels, region, roles, stock, vendor |

---

## 0. Asset inventory (what we already have)

### 0.1 Medusa clones (chaos to collapse)

| Path | Role | Disposition |
|---|---|---|
| `/home/amber/alkemart-medusa` | **Running** backend (cwd of pid on :9000); has marketplace **migration** | Canonical runtime until monorepo sync |
| `/mnt/c/src/Alkemart4/alkemart-medusa` | Partial copy; **missing** `Migration20260715111916.ts` | Sync from home, then sole git source |
| `/home/amber/medusa-solo` | Earlier `@alkemart/backend` experiment (deps only) | Archive / delete after Phase 0 |
| `/home/amber/test-medusa`, `test-medusa2` | Empty stubs | Delete |

### 0.2 Alkemart advanced backend (keep as reference → port)

| Capability | Location | Status in Express | Port target in Medusa |
|---|---|---|---|
| Checkout + quote + stock hold | `artifacts/api-server/src/lib/checkout.ts` (~675 LOC) | Implemented (sync MoMo path) | Custom workflow `complete-ghana-checkout` |
| Paystack charge/refund/verify/HMAC | `.../lib/paystack.ts` | Implemented | Payment provider module + webhook route |
| Payment intents | `lib/db/src/schema/payment-intents.ts` | Schema + partial wiring | Module model or custom table via Medusa module |
| Webhooks | `.../routes/webhooks.ts` | Signature + charge.success skeleton | `src/api/hooks/paystack/route.ts` |
| Settlements | `.../routes/settlements.ts` + schema | Implemented under flag | `settlements` module |
| Outbox | `.../lib/outbox.ts` + schema | Implemented under flag | Job + module table (or Medusa event bus + outbox table) |
| CASL AuthZ | `lib/abilities` + `authz.ts` | Working | Roles via customer metadata / actor + custom middleware |
| Platform config | `.../lib/platform-config.ts` | Good pattern | `@workspace/platform-config` shared package |
| OpenAPI contracts | `lib/api-spec/openapi.yaml` | Full marketplace surface | Evolve → **Storefront BFF contract** or Medusa OpenAPI + custom routes documented |
| Tests | checkout-promo-race, vendor isolation, messaging | Regression suite | Port critical races to Medusa integration tests |

### 0.3 Frontend / UI-UX (preserve)

| Asset | Path | Notes |
|---|---|---|
| Storefront chrome + 56 shop components | `artifacts/alkemart/src/components/shop/*` | Walmart-style hierarchy already partially applied |
| Hardcode audit | `docs/superpowers/specs/2026-07-13-frontend-hardcode-architecture-audit.md` | P0 fake-commerce fixes already done once — **do not regress** |
| UX hierarchy | `docs/superpowers/specs/2026-07-13-walmart-multivendor-ux.md` | Card order: image → price → title → vendor → rating → add |
| Money display | `artifacts/alkemart/src/lib/money.ts` | Keep; amounts must stay pesewas |
| Homepage CMS schemas | `homepage-section-configs.ts`, `homepage-themes.ts` | Keep; backend must serve real sections |
| Routes | Full buyer/vendor/admin file routes | Keep shells; rewire data only |
| Broken migration layer | `hooks-*.ts`, `api-stubs.ts` (~720 LOC), dual SDK | **Replace** with single client + typed domain |

### 0.4 What is currently broken (must be fixed, not papered over)

1. Publishable API key linked to **multiple sales channels** → cart create fails  
2. SPA `cart.create({})` missing `region_id` + `sales_channel_id`  
3. Add-to-cart passes **product id** as `variant_id`  
4. Store API returns **no calculated prices** → UI shows GH₵0.00  
5. Products not linked to categories  
6. `stock: inventory_quantity ?? 10` and `vendor: default-vendor` hardcodes  
7. Auth roles hard-coded `["buyer"]` → admin/vendor CASL dead  
8. Signup not using Medusa register flow  
9. Express down → all stubs fail (home CMS, checkout, vendor, admin)  
10. 179 TypeScript errors  
11. Deploy docs still Express-only  
12. Dual Medusa trees + missing migration in monorepo  
13. JWT/COOKIE secrets are `supersecret`; Redis URL dead  

---

## 1. Target architecture (production)

```
┌─────────────────────────────────────────────────────────────┐
│  SPA (Cloudflare Pages)                                     │
│  TanStack Router/Query + design system                      │
│  lib/commerce/*  typed domain (no raw SDK in routes)        │
│  single Medusa SDK (jwt or session, env-only config)        │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS + publishable key
                            │ CORS allowlist = production origins only
┌───────────────────────────▼─────────────────────────────────┐
│  Medusa Backend (Fly/Railway) :9000                         │
│  ┌──────────── Store API ────────────┐                      │
│  │ products, cart, customer, orders  │  (Medusa core)       │
│  └───────────────────────────────────┘                      │
│  ┌──────────── Custom modules ───────┐                      │
│  │ marketplace (vendor, staff, links)│                      │
│  │ paystack (AbstractPaymentProvider)│                      │
│  │ settlements, disputes, homepage   │                      │
│  │ messaging (optional phase)        │                      │
│  └───────────────────────────────────┘                      │
│  ┌──────────── Workflows (ACID) ─────┐                      │
│  │ ghana-checkout (hold, intent,     │                      │
│  │   charge, confirm, compensate)    │                      │
│  │ payment-ttl, settlement-generate  │                      │
│  └───────────────────────────────────┘                      │
│  ┌──────────── Jobs ─────────────────┐                      │
│  │ outbox worker, payment TTL,       │                      │
│  │ orphan intent recovery            │                      │
│  └───────────────────────────────────┘                      │
└───────────────┬─────────────────────┬───────────────────────┘
                │                     │
         Neon Postgres            Redis (required prod)
         (single DB)              cache + locks if needed
                │
         Paystack (MoMo + webhooks)
```

### 1.1 What Medusa owns vs what we own

| Domain | Owner | Notes |
|---|---|---|
| Product / variant / price / category | Medusa | Seed + admin; no dual catalog |
| Cart / line items / region | Medusa | SPA must pass region + sales channel |
| Customer auth | Medusa | Roles via metadata or linked actor |
| Inventory | Medusa inventory module | Map reserved-hold semantics carefully |
| Order lifecycle core | Medusa | Extend with Ghana payment status |
| MoMo async + intents + webhook | **Us** | Port Express ADR logic into workflows |
| Multi-vendor ownership | **Us** | marketplace module + links |
| Settlements / commission | **Us** | port settlement tables + generate/mark-paid |
| Disputes, homepage CMS, messaging | **Us** | custom modules or deferred with static fallbacks |
| UI chrome / UX hierarchy | SPA | unchanged design system |

### 1.2 Anti-hardcode / anti-magic rules (enforced in review)

1. **Config only via env + shared package**  
   - Backend: `process.env` → validated config module (zod)  
   - Frontend: `import.meta.env.VITE_*` — **fail boot** if missing in production build (`import.meta.env.PROD`)  
   - Forbidden: `?? "http://localhost:9000"`, `?? "pk_default"`, `roles: ["buyer"]`, `stock ?? 10`, `slug: "default-vendor"`

2. **IDs are typed**  
   - `ProductId`, `VariantId`, `CartId`, `OrderId`, `VendorId` branded strings  
   - Never pass product id where variant id required

3. **Money**  
   - Domain field names `*Pesewas: number` (integer)  
   - Adapter maps Medusa minor units → pesewas explicitly with currency check  
   - No float math in checkout

4. **No silent catch-and-empty for money paths**  
   - Cart/checkout/product price failures must surface error states  
   - `throwOnError: false` only for optional chrome (notifications)

5. **No dual backends in production**  
   - Feature flags may keep Express in **dev only** until cutover  
   - Production SPA has no `/api` proxy to Express

---

## 2. Workstreams (execute in order)

```
Phase 0  Repo + runtime hygiene          [blocking]
Phase 1  Backend config + DB truth       [blocking]
Phase 2  Catalog correctness             [blocking storefront]
Phase 3  Commercial spine on Medusa      [blocking money]
Phase 4  Marketplace multi-vendor        [blocking vendors]
Phase 5  SPA commerce domain layer       [blocking FE]
Phase 6  Wire routes + kill stubs        [blocking UX]
Phase 7  Ghana modules (CMS, disputes…)  [launch polish]
Phase 8  Deploy, secrets, CI, cutover    [production]
```

Each phase ends with a **Definition of Done** gate. Do not start the next phase until the gate is green.

---

## Phase 0 — Single source of truth (repo & process)

**Goal:** One Medusa backend path, no clone confusion, git-ready layout, Express frozen as reference.

### Task 0.1: Designate canonical Medusa path

**Files:**
- Canonical: `alkemart-medusa/` **inside** monorepo (git tracked, no `node_modules`)  
- Runtime during WSL: prefer copy to `/home/amber/alkemart-medusa` via rsync **from** monorepo, never the reverse after cutover

- [ ] **Step 1:** Diff trees and copy missing migration into monorepo

```bash
# From monorepo root
diff -rq /home/amber/alkemart-medusa/apps/backend/src \
  alkemart-medusa/apps/backend/src | grep -v node_modules

cp -a /home/amber/alkemart-medusa/apps/backend/src/modules/marketplace/migrations/. \
  alkemart-medusa/apps/backend/src/modules/marketplace/migrations/
```

- [ ] **Step 2:** Ensure monorepo `alkemart-medusa/apps/backend/.gitignore` ignores `.env`, `node_modules`, `.medusa`, `dist`

- [ ] **Step 3:** Add monorepo root ignore rules if needed:

```
# .gitignore additions
alkemart-medusa/**/node_modules/
alkemart-medusa/**/.medusa/
alkemart-medusa/**/dist/
```

- [ ] **Step 4:** Document operational rule in `alkemart-medusa/README.md`:

```markdown
# Alkemart Medusa Backend
Source of truth: this directory in the Alkemart4 monorepo.
Do not edit /home/amber/alkemart-medusa except as a runtime worktree synced from here.
```

- [ ] **Step 5:** Archive experiments

```bash
mkdir -p ~/archive && mv ~/medusa-solo ~/test-medusa ~/test-medusa2 ~/archive/ 2>/dev/null || true
```

**DoD:** Monorepo contains full marketplace migration; only one intentional backend tree in git.

### Task 0.2: Freeze Express as reference, not runtime for SPA

**Files:**
- Modify: `artifacts/alkemart/vite.config.ts` (document dual proxy as **dev-only temporary**)
- Create: `docs/architecture/2026-07-15-medusa-target-architecture.md` (short link to this plan)

- [ ] **Step 1:** Add banner comment at top of `api-stubs.ts` that production builds must not import it  
- [ ] **Step 2:** List every Express-only capability that must be ported (use inventory §0.2)  
- [ ] **Step 3:** Commit message convention: `chore(medusa): phase0 ...`

**DoD:** Team agrees Express is not production path.

### Task 0.3: Baseline commit strategy

- [ ] **Step 1:** Do **not** commit all 275 dirty files as one dump  
- [ ] **Step 2:** Phase commits: `chore: sync medusa tree` → `feat(backend): ...` → `feat(spa): ...`  
- [ ] **Step 3:** Never commit `.env`, publishable keys in docs beyond non-prod

---

## Phase 1 — Backend first principles (config, secrets, DB)

**Goal:** Medusa boots with validated config, migrations applied, Redis live, secrets not toy values.

### Task 1.1: Zod-validated Medusa config

**Files:**
- Create: `alkemart-medusa/apps/backend/src/lib/env.ts`
- Modify: `alkemart-medusa/apps/backend/medusa-config.ts`
- Modify: `alkemart-medusa/apps/backend/.env.template`

- [ ] **Step 1:** Define required env schema

```ts
// src/lib/env.ts
import { z } from "zod"

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  STORE_CORS: z.string().min(1),
  ADMIN_CORS: z.string().min(1),
  AUTH_CORS: z.string().min(1),
  // Commerce context — no hardcodes in app code
  ALKEMART_REGION_ID: z.string().min(1).optional(), // filled after seed; required in prod
  ALKEMART_SALES_CHANNEL_ID: z.string().min(1).optional(),
  ALKEMART_PUBLISHABLE_KEY: z.string().optional(), // ops reference only
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  DEFAULT_CURRENCY: z.string().default("ghs"),
  DEFAULT_COUNTRY_CODE: z.string().default("gh"),
  PAYMENT_PENDING_TTL_MINUTES: z.coerce.number().int().min(10).max(120).default(30),
  DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(700),
})

export type AppEnv = z.infer<typeof EnvSchema>

export function loadAppEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment configuration")
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.JWT_SECRET === "supersecret" || parsed.data.COOKIE_SECRET === "supersecret") {
      throw new Error("Refusing to start with default secrets in production")
    }
    if (!parsed.data.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY required in production")
    }
    if (!parsed.data.ALKEMART_REGION_ID || !parsed.data.ALKEMART_SALES_CHANNEL_ID) {
      throw new Error("ALKEMART_REGION_ID and ALKEMART_SALES_CHANNEL_ID required in production")
    }
  }
  return parsed.data
}
```

- [ ] **Step 2:** Wire `medusa-config.ts` to use `loadAppEnv()` for CORS/DB/JWT  
- [ ] **Step 3:** Update `.env.template` with every key and comments (no real secrets)

**DoD:** Medusa refuses to start with invalid/missing secrets in production mode.

### Task 1.2: Redis + Neon connectivity

- [ ] **Step 1:** Run Redis locally (`docker run -p 6379:6379 redis:7-alpine`) or point `REDIS_URL` at managed Redis  
- [ ] **Step 2:** Confirm Medusa uses Redis (not in-memory) when `REDIS_URL` set  
- [ ] **Step 3:** Prefer Neon **pooled** connection string for server; migrate CLI during stable window  
- [ ] **Step 4:** Document: never run concurrent `medusa db:migrate` against Neon from flaky WSL

**DoD:** `redis-cli PING` → PONG; Medusa health OK after restart with Redis.

### Task 1.3: Apply all migrations including marketplace + links

- [ ] **Step 1:** `npx medusa db:migrate` from canonical backend (one attempt, wait for completion)  
- [ ] **Step 2:** Verify tables exist (via admin SQL or script):

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE '%vendor%' OR tablename LIKE '%marketplace%')
ORDER BY 1;
```

- [ ] **Step 3:** Generate/run link migrations for `vendor-product`, `vendor-order`  
- [ ] **Step 4:** Smoke: `container.resolve("marketplaceModuleService")` in a `medusa exec` script succeeds

**DoD:** Marketplace module resolves; vendor tables exist.

### Task 1.4: Shared platform-config package (no duplicated defaults)

**Files:**
- Create: `lib/platform-config/` (workspace package)  
- Move non-secret defaults from Express `platform-config.ts` and SPA `markets.ts` overlaps

Exports (minimum):

```ts
export const DEFAULT_CURRENCY = "GHS"
export const DEFAULT_CURRENCY_SYMBOL = "GH₵"
export const DEFAULT_COUNTRY_CODE = "GH"
export const DEFAULT_LOCALE = "en-GH"
export const DEFAULT_COMMISSION_BPS = 700
export const LIVE_CURRENCY_MINOR_NAME = "pesewas"
```

**DoD:** SPA money + Medusa seed import same package; no drift.

---

## Phase 2 — Catalog correctness (no magic stock/prices)

**Goal:** Store API returns real prices, inventory, categories; PK has **exactly one** sales channel.

### Task 2.1: Fix publishable key ↔ sales channel (critical)

**Files:**
- Modify: `alkemart-medusa/apps/backend/src/scripts/create-publishable-key.ts`

- [ ] **Step 1:** Rewrite script to link **only** `Alkemart Storefront` channel (delete dual-link logic)  
- [ ] **Step 2:** Run script; verify cart create:

```bash
curl -sS -X POST "$MEDUSA_URL/store/carts" \
  -H "x-publishable-api-key: $PK" \
  -H "content-type: application/json" \
  -d "{\"region_id\":\"$REGION_ID\",\"sales_channel_id\":\"$SC_ID\"}"
# Expect: cart.id present
```

- [ ] **Step 3:** Persist `ALKEMART_SALES_CHANNEL_ID` and `ALKEMART_REGION_ID` into backend `.env` and SPA `.env` as `VITE_MEDUSA_REGION_ID` / `VITE_MEDUSA_SALES_CHANNEL_ID`

**DoD:** Empty body cart create may still fail without IDs; **with** region+SC it succeeds. PK multi-channel error gone.

### Task 2.2: Deterministic Ghana seed (idempotent, priced, categorized)

**Files:**
- Rewrite: `src/scripts/seed-ghana.ts`

Requirements:

1. Create/update region GHS + country GH  
2. Create **one** sales channel “Alkemart Storefront”  
3. Create categories with stable handles  
4. Create products with variants; prices via **Pricing Module** (not only product embed if that path drops prices)  
5. Link product ↔ category  
6. Link product ↔ sales channel  
7. Create inventory levels with real quantities (no fake 10)  
8. Print IDs at end for env population  
9. Fully idempotent (safe re-run)

- [ ] **Step 1:** After seed, verify:

```bash
curl -sS "$MEDUSA_URL/store/products?limit=1&region_id=$REGION_ID" \
  -H "x-publishable-api-key: $PK" | jq '.products[0].variants[0].calculated_price'
# Expect non-null calculated_amount
```

- [ ] **Step 2:** Verify categories non-empty on product  
- [ ] **Step 3:** Verify amount units: if Medusa stores major for GHS incorrectly, fix seed to match **pesewas** convention and document in ADR note

**DoD:** 12 products with non-null calculated prices, categories linked, inventory set.

### Task 2.3: Integration test for catalog contract

**Files:**
- Create: `alkemart-medusa/apps/backend/integration-tests/http/catalog.spec.ts`

Assertions:

- List products with region → every item has `calculated_price.calculated_amount` number  
- Category filter returns only linked products  
- No product has empty variants  

**DoD:** Test green in CI/local.

---

## Phase 3 — Commercial spine on Medusa (ACID money path)

**Goal:** Port Express checkout ADRs into Medusa workflows. This is the heart of production.

### Task 3.1: Payment intent model (ADR-014)

**Files:**
- Create module `src/modules/payments-ghana/` **or** extend paystack module models:

```
payment_intent
  id, order_id, cart_id
  client_reference (unique)
  provider_reference (unique when not null)
  amount_pesewas (int)
  currency (ghs)
  status: initiated | pending | succeeded | failed | expired
  expires_at
  metadata jsonb
```

- [ ] **Step 1:** Migration  
- [ ] **Step 2:** Service methods: `createInitiated`, `attachProviderReference`, `markSucceeded` (idempotent), `markExpired`  
- [ ] **Step 3:** Unique constraints per ADR-005/014

**DoD:** Cannot insert two intents with same provider_reference.

### Task 3.2: Register Paystack provider (no hardcodes)

**Files:**
- Modify: `medusa-config.ts` modules:

```ts
{
  resolve: "@medusajs/medusa/payment",
  options: {
    providers: [
      {
        resolve: "./src/modules/paystack",
        id: "paystack",
        options: {
          secretKey: process.env.PAYSTACK_SECRET_KEY,
          publicKey: process.env.PAYSTACK_PUBLIC_KEY,
        },
      },
    ],
  },
},
```

- [ ] **Step 1:** Port charge/refund/verify/HMAC from `artifacts/api-server/src/lib/paystack.ts` into provider + shared `src/lib/paystack-client.ts`  
- [ ] **Step 2:** Amount always integer pesewas; reject non-integer  
- [ ] **Step 3:** Metadata required: `order_id`, `payment_intent_id`, `client_reference`  
- [ ] **Step 4:** Unit tests with mocked fetch

**DoD:** Provider registers; system provider still available for COD/dev.

### Task 3.3: Ghana checkout workflow (ACID)

**Files:**
- Create: `src/workflows/ghana-checkout/`  
  - `create-pending.ts`  
  - `confirm-paid.ts`  
  - `abandon-pending.ts`  
  - `cancel-order.ts`

**Algorithm (from architecture B.1) — implement literally:**

**createPending (single DB transaction where framework allows; otherwise compensating steps documented):**

1. Load cart; validate non-empty, all variants active  
2. Quote totals (subtotal − promo + shipping + tax) in **pesewas**  
3. Soft-lock cart / mark checkout-in-progress  
4. Reserve inventory (map to Medusa inventory reservation or custom reserved field)  
5. Create Medusa order in **pending** / payment collection pending  
6. Insert `payment_intent` initiated with `clientReference` UUID  
7. **Commit** intent before external I/O  
8. Call Paystack charge with metadata  
9. Persist `providerReference`; if charge already success → confirmPaid; if pending → return 202  
10. Outbox: `order.payment_pending` (not `order.placed`)

**confirmPaid (idempotent):**

1. `SELECT payment_intent FOR UPDATE` by reference  
2. If already succeeded → return existing order  
3. Revalidate promo under lock (ADR-013); mismatch → refund + release hold  
4. Amount/currency invariant check  
5. Convert reservation → sold  
6. Mark intent succeeded; append payment event  
7. Clear cart lock; complete order paid  
8. Outbox: `order.placed`

**abandon / TTL job:**

1. Find intents past `expires_at` still pending  
2. Release reservation; expire intent; cancel unpaid order  
3. Outbox: `order.payment_expired`

**DoD:** Integration tests: happy path MoMo mock, double webhook, amount mismatch refund, TTL abandon, promo race.

### Task 3.4: Webhook route

**Files:**
- Create: `src/api/hooks/paystack/route.ts`  
- Mount raw body for HMAC  

Port logic from Express `webhooks.ts` + confirmPaid.

**DoD:** Invalid signature → 401; duplicate charge.success → 200 no double side effects.

### Task 3.5: COD path

- [ ] COD remains sync: create order `cod_pending`, no Paystack, create fulfillments, outbox `order.placed`  
- [ ] Same inventory convert rules as paid (or hold until packed — **decide and document**: recommend convert on place for COD like current Express)

**DoD:** COD checkout works without Paystack keys in dev.

### Task 3.6: Cancel compensation (ADR cancel matrix)

Port cancel matrix from architecture B.2:

| State | Stock | Refund |
|---|---|---|
| pending unpaid | release reservation only | no |
| paid, no ship | restock + Paystack refund | yes |
| any fulfillment shipped+ | **reject cancel** | — |

**DoD:** Tests for each row.

### Task 3.7: Outbox worker job

Port `outbox.ts` SKIP LOCKED worker to Medusa scheduled job:

- Handlers: notifications (later), email, analytics hooks  
- Max 10 attempts; poison alert log  

**DoD:** Kill process mid-handler; restart; event eventually processed once effectively (idempotent handler).

---

## Phase 4 — Marketplace multi-vendor

**Goal:** Vendors own products/orders; store pages real; commission ready for settlements.

### Task 4.1: Marketplace module complete

- [ ] Vendor + VendorStaff models (already started)  
- [ ] Migrations applied  
- [ ] Admin API routes: list/update vendor status, commission_bps  
- [ ] Seed 4 vendors; link products via `vendor-product` link  
- [ ] Store product adapter resolves vendor from link — **no default-vendor**

### Task 4.2: Vendor actor auth

Options (pick one in implementation; recommended A):

**A.** Medusa user (admin) + custom middleware mapping user → vendor_staff  
**B.** Customer metadata `roles: ["vendor"]` + `vendor_id` (weaker)

- [ ] Implement `requireVendor` middleware for `/vendor/*` custom routes  
- [ ] Row-level: only linked products/orders  

### Task 4.3: Vendor product + order APIs

Port behaviors from Express `routes/vendor.ts` (CRUD, soft-delete, fulfillment status).

**DoD:** Vendor isolation test (port from Express analytics-vendor-isolation).

### Task 4.4: Settlements module (ADR-009)

Port `settlements` schema + generate/mark-paid from Express.

Eligibility: vendor fulfillment `delivered`; commission on line subtotals; marketplace absorbs promo v1.

**DoD:** Generate idempotent per vendor+period; mark-paid only admin.

---

## Phase 5 — SPA commerce domain layer (frontend construction)

**Goal:** Routes never call raw SDK or stubs; single typed facade; no hardcodes.

### Task 5.1: Single Medusa client factory

**Files:**
- Delete dual: keep only `src/lib/medusa/client.ts`  
- Remove unused singleton if provider owns instance  
- `auth.ts` beforeLoad **must** use same client module, not construct third SDK

```ts
// src/lib/medusa/client.ts
import Medusa from "@medusajs/js-sdk"

function requiredEnv(name: string): string {
  const v = import.meta.env[name]
  if (!v || (import.meta.env.PROD && (v.includes("localhost") || v === "pk_default"))) {
    throw new Error(`Missing or invalid ${name}`)
  }
  return v as string
}

export function createMedusaClient() {
  return new Medusa({
    baseUrl: requiredEnv("VITE_MEDUSA_BACKEND_URL"),
    publishableKey: requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY"),
    auth: {
      type: "jwt", // prefer JWT for cross-origin SPA; store in memory/local per security review
      jwtTokenStorageMethod: "local",
    },
  })
}

export const commerceContext = {
  regionId: () => requiredEnv("VITE_MEDUSA_REGION_ID"),
  salesChannelId: () => requiredEnv("VITE_MEDUSA_SALES_CHANNEL_ID"),
}
```

### Task 5.2: Domain types (match UI already built)

**Files:**
- Create: `src/lib/commerce/types.ts`

Align with **existing UI fields** (what routes already expect), not half-migrated shapes:

```ts
export type ProductId = string & { readonly __brand: "ProductId" }
export type VariantId = string & { readonly __brand: "VariantId" }

export type CommerceProduct = {
  id: ProductId
  variantId: VariantId
  title: string
  handle?: string
  description?: string
  brand?: string
  tag?: "rollback" | "clearance" | "best" | "popular" | "new" | null
  pricePesewas: number
  compareAtPesewas?: number
  ratingAvgX100: number
  ratingCount: number
  imageUrl: string
  stock: number // real sellable qty; 0 if unknown and unavailable
  categoryHandle?: string
  vendor: { slug: string; name: string; ratingAvgX100: number; ratingCount: number }
}

export type CommerceCart = {
  id: string
  items: Array<{
    id: string
    qty: number
    variantId: VariantId
    product: { title: string; pricePesewas: number; imageUrl: string; productId: ProductId }
  }>
  subtotalPesewas: number
}

export type CommerceOrder = {
  id: string
  status: string
  totalPesewas: number
  currencyCode: string
  createdAt: string
  items: Array<{ id: string; titleSnapshot: string; qty: number; unitPesewas: number; thumbnail?: string }>
  // extend as order detail needs: fulfillments, address, paymentMethod, ...
}
```

**Rule:** Adapters map Medusa → these types. UI keeps consuming Alkemart field names (`titleSnapshot`, `totalPesewas`) so we don't thrash 30 routes twice.

### Task 5.3: Replace hooks-products/cart/auth/orders

- [ ] Products: pass `region_id` on every list/retrieve; map `calculated_price.calculated_amount` → `pricePesewas`  
- [ ] Cart: create with `region_id` + `sales_channel_id`; line items use `variantId`  
- [ ] Auth: register via `sdk.auth.register`; roles from `customer.metadata.roles` array (admin-set)  
- [ ] Orders: map to `CommerceOrder` with `titleSnapshot`/`qty`/`totalPesewas`  
- [ ] **Delete** silent `stock ?? 10` and `default-vendor`  
- [ ] If vendor missing → omit vendor line (UI already optional), never invent

### Task 5.4: Kill `api-stubs.ts` by feature

Replace in this order (each step typecheck subset):

1. Addresses (Medusa customer addresses)  
2. Checkout (custom Medusa route wrapping ghana-checkout workflow)  
3. Homepage sections (homepage module or static JSON fallback from `commerce-content` **without prices**)  
4. Orders cancel/dispute  
5. Vendor routes  
6. Admin routes (prefer Medusa Admin `/app` for catalog; keep custom SPA for Ghana ops)

Until a feature is replaced, **feature-flag** the route to an honest “Coming soon / ops only” page — **do not** call dead Express.

### Task 5.5: Typecheck gate

- [ ] `bun run typecheck` → 0 errors  
- [ ] `bun run build` → success  
- [ ] Fix `_shop.store.$slug.tsx` (broken vendor refs) as part of vendor wiring  

**DoD:** CI typecheck mandatory.

---

## Phase 6 — Wire UI without hiccups

**Goal:** Every buyer path works end-to-end with existing UX components.

### Buyer journeys (acceptance scripts)

| Journey | Steps | Pass criteria |
|---|---|---|
| Browse | Home → department → PLP | Real prices, no GH₵0, no fake products |
| PDP | Open product → stock truthful → add | Uses variantId; cart count increments |
| Cart | Update qty, remove | Totals correct pesewas |
| Auth | Signup, login, logout, me | Session/JWT persists refresh |
| Address | CRUD Ghana address + digitalAddress | Survives reload |
| Checkout MoMo | Select address + MoMo → pending → webhook mock → paid | Order appears; stock converted |
| Checkout COD | Place COD order | Order `cod_pending` |
| Orders | List + detail | Matches CommerceOrder fields |
| Cancel | Unpaid pending vs paid unshipped | Matrix respected |

### Vendor / admin journeys

| Journey | Pass criteria |
|---|---|
| Vendor products CRUD | Isolation; no cross-vendor |
| Vendor fulfill | Status advances; settlement eligibility |
| Admin vendors | Commission + status |
| Admin homepage | Sections drive home (or static fallback without fake prices) |
| Admin settlements | Generate + mark-paid |

### UX non-regressions

- [ ] Product card hierarchy unchanged (price before title)  
- [ ] No Chromebook/demo content  
- [ ] Empty states remain honest  
- [ ] Header cart badge uses real cart  
- [ ] Categories from API with content fallback labels only (no fake SKUs)

---

## Phase 7 — Remaining Ghana modules

### Task 7.1: Homepage module

- Models: section type, sort, enabled, config jsonb, image  
- Store list + admin update  
- Seed default sections pointing at real category handles / tags  

### Task 7.2: Disputes module

- Port Express dispute schema + admin resolve  
- Link to Medusa order id (string)

### Task 7.3: Messaging

- Defer OK for MVP if flagged  
- If ship: keep conversations tables as module  

### Task 7.4: Image moderation

- Port object storage upload + approve/reject or use Medusa file module + custom moderation flags  

---

## Phase 8 — Production packaging & cutover

### Task 8.1: Deploy topology

```
Cloudflare Pages  →  SPA static (VITE_* prod URLs)
Fly/Railway       →  Medusa (web) + worker process (jobs)
Neon              →  Postgres
Upstash/Redis     →  REDIS_URL
Paystack          →  live keys + webhook → https://api.../hooks/paystack
```

- [ ] Rewrite `DEPLOYMENT.md` completely (delete Express-as-primary)  
- [ ] New Dockerfile for Medusa (Node 22), multi-stage  
- [ ] `fly.toml` / railway for Medusa; separate SPA deploy  
- [ ] Health checks: `/health`  
- [ ] Autoscaling min 1 for webhook reliability (or accept cold-start risk)

### Task 8.2: Secrets & CORS

- [ ] Generate 32+ char JWT/COOKIE secrets  
- [ ] `STORE_CORS` / `AUTH_CORS` = production SPA origin only  
- [ ] Webhook URL registered in Paystack dashboard  

### Task 8.3: CI

```yaml
# minimum
- install
- typecheck SPA
- medusa build
- unit tests paystack/money
- integration tests catalog + checkout (testcontainers or Neon branch)
```

### Task 8.4: Cutover checklist

1. Migrations applied on prod Neon branch  
2. Seed categories + pilot catalog (or migrate from Express PG)  
3. Publishable key single SC  
4. SPA env set  
5. Paystack webhook verified in staging  
6. Run buyer journeys on staging  
7. Freeze Express; remove SPA stubs from production build  
8. Monitor: payment_intent orphans, outbox poison, 5xx rate  

### Task 8.5: Data migration (if Express PG has real data)

Order:

1. Vendors → marketplace module  
2. Products → Medusa products + links  
3. Customers → Medusa customers (password reset required if hashes incompatible)  
4. Open orders → careful (prefer finish Express orders before cutover)  
5. Settlements historical → import ledger  

Prefer **hard cutover** after draining open MoMo pendings.

---

## 3. Explicit non-goals (keep scope honest)

- Self-serve vendor KYC onboarding  
- Live multi-currency checkout  
- Courier integrations / rate engines  
- Full i18n  
- Rebuilding design system  
- Keeping Express dual-homed in production “for a while”

---

## 4. Risk register

| Risk | Mitigation |
|---|---|
| Neon flaky from WSL CLI | Local Postgres for migrate; Neon for server only |
| Medusa inventory ≠ reservedStock model | Spike early in Phase 3; custom reservation table if needed |
| JWT cross-origin cookie issues | Prefer JWT storage for SPA |
| Price unit mismatch (major vs minor) | Single test asserting seed 189900 pesewas → display GH₵1899.00 |
| Scope explosion (messaging/CMS) | Feature flags; static homepage fallback |
| Losing Express race tests | Port before deleting Express |

---

## 5. Definition of Production Ready (final gate)

All must be true:

- [ ] One Medusa source tree in git; Express not required for SPA  
- [ ] `typecheck` + `build` green  
- [ ] Catalog: prices, categories, inventory real  
- [ ] Cart create + line items + totals correct  
- [ ] Signup/login/roles work for buyer; admin via Medusa Admin or SPA with real roles  
- [ ] MoMo: pending → webhook confirm idempotent; TTL abandon; amount mismatch refund  
- [ ] COD works  
- [ ] Cancel compensation matrix enforced  
- [ ] Outbox durable  
- [ ] Settlements generate/mark-paid  
- [ ] Marketplace vendor isolation  
- [ ] No hardcodes for env/IDs/stock/vendor/roles in SPA or backend  
- [ ] Deploy docs match reality; secrets strong; Redis live  
- [ ] Staging buyer + vendor + admin journeys signed off  

---

## 6. Suggested PR / commit slices

| PR | Title | Depends |
|---|---|---|
| PR-0 | chore: single medusa tree + env schema + redis | — |
| PR-1 | fix: sales channel PK + ghana seed + catalog tests | PR-0 |
| PR-2 | feat: paystack provider + payment intents | PR-0 |
| PR-3 | feat: ghana-checkout workflows + webhooks + TTL | PR-2, PR-1 |
| PR-4 | feat: marketplace module live + vendor APIs | PR-1 |
| PR-5 | feat: SPA commerce domain + cart/product/auth rewrite | PR-1 |
| PR-6 | feat: SPA checkout + addresses + orders wiring | PR-3, PR-5 |
| PR-7 | feat: settlements + cancel compensation | PR-3, PR-4 |
| PR-8 | feat: homepage/disputes modules + kill stubs | PR-5 |
| PR-9 | chore: deploy Medusa + CI + cutover docs | PR-6+ |

---

## 7. First execution day (concrete)

If starting execution immediately, do **only** this sequence:

1. Phase 0.1 — sync migration into monorepo  
2. Phase 1.1 — env validation (reject supersecret in prod)  
3. Phase 2.1 — fix PK to single sales channel  
4. Phase 2.2 — reseed prices/categories  
5. Phase 5.1–5.3 — SPA client + product/cart hooks without hardcodes  
6. Manual smoke: list products with prices → add to cart → retrieve cart  

Stop and reassess before MoMo workflows if inventory reservation mapping is unclear — spike that as Phase 3.0 before coding charge paths.

---

## 8. Spec coverage self-check

| Requirement source | Covered by |
|---|---|
| Migration spec phases 1–5 | Phases 0–6 |
| Commercial spine ADRs 001–014 | Phase 3 + 4.4 + 1.4 |
| Frontend hardcode audit | Phase 5–6 + CFG-0 |
| Walmart multi-vendor UX | Phase 6 non-regressions |
| Dual Medusa clones | Phase 0 |
| Express advanced checkout/outbox/settlements | Phase 3–4 (port, not abandon) |
| Production deploy | Phase 8 |

**Placeholder scan:** none intentional; spikes called out only for inventory mapping.

---

## 9. Execution choice (for the human)

Plan complete and saved to `docs/superpowers/plans/2026-07-15-medusa-production-readiness.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task/PR slice, review between tasks  
2. **Inline Execution** — this session executes Phase 0→2 first with checkpoints  

Also available: run the formal `/design` loop to turn this master plan into a shorter ADR-style design doc with PR Plan consensus if you want stakeholder sign-off before coding.
