# Cloudflare Ghana Multivendor Marketplace — Plan 2: Identity + Seller Write

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auth (buyer/seller/admin), seller registration + Ghana onboarding (including **Paystack** MoMo transfer recipient), seller-scoped product/offer writes, and admin approve/suspend/moderate — on the Cloudflare Workers API from Plan 1.

**Architecture:** Extend Hono `/store`, `/vendor`, `/admin` with JWT sessions (or signed cookies). Seller writes always filter by `auth.sellerId`. Ghana seller payout setup calls **Paystack Transfer Recipient** only (no generic PSP). Catalog sellable rules from Plan 1 stay authoritative for public reads.

**Tech Stack:** Hono, Drizzle, Neon/Hyperdrive, Vitest, Zod, existing `@alkemart/shared/ghana` MoMo providers, Paystack REST (secret key server-side only).

**Spec:** `docs/superpowers/specs/2026-08-31-cloudflare-ghana-marketplace-design.md` (§3.1 Multivendor spine, §5 Paystack-only money)

**Depends on:** Plan 1 (`feat/cloudflare-multivendor-plan1` packages `api`, `db`, `domain`, `api-client`)

**Next:** Plan 3 — multi-seller cart + **Paystack** MoMo/card checkout + OrderGroup (not this plan)

## Global Constraints

- **Paystack only** for paid rails and seller payout recipients — never Stripe/Flutterwave/generic PaymentProvider interfaces in v1.
- Multivendor spine: Product ≠ Offer; vendor mutations `WHERE seller_id = auth.seller_id`.
- Pesewas `bigint` / string in APIs; Paystack amounts are pesewas.
- Fail closed: missing `PAYSTACK_SECRET_KEY` → seller payout setup and (later) charge routes error loudly.
- OpenAPI updated for new routes; regenerate or extend `@alkemart/api-client`.
- Do not modify Medusa `apps/backend` runtime (read `paystack-client.ts` as reference only).
- Commits: `git -c user.name="Lamptey Odartei Isaiah" -c user.email="isaiahamber5@gmail.com"`.
- Prefer in-memory repos for tests when Hyperdrive/Neon unavailable.

---

## File structure (this plan)

```
Alkemart4/
  packages/
    db/src/schema/
      users.ts              # NEW — users, auth_identities, sessions
      # sellers.ts already exists — add payout fields if missing
    domain/src/
      auth.ts               # password hash verify (webcrypto/bcryptwasm)
      seller-readiness.ts   # Ghana readiness gates
      moderation.ts         # propose/publish/reject transitions
    paystack/               # NEW package OR packages/domain/paystack.ts
      client.ts             # port verify/charge/recipient helpers — Paystack-named
  apps/api/src/
    middleware/auth.ts
    routes/store/auth.ts
    routes/vendor/
      auth.ts
      me.ts
      onboarding.ts         # ghana-setup → Paystack recipient
      products.ts           # seller-scoped CRUD + propose
    routes/admin/
      sellers.ts            # approve/suspend/unsuspend/terminate/commission
      products.ts           # approve/reject/request-changes
    lib/paystack.ts         # thin wrapper; secret from env
```

---

### Task 1: Auth schema + password helpers

**Files:**
- Create: `Alkemart4/packages/db/src/schema/users.ts`
- Modify: `Alkemart4/packages/db/src/schema/index.ts`, generate migration
- Create: `Alkemart4/packages/domain/src/auth.ts`
- Test: `Alkemart4/packages/domain/src/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - Tables: `users` (`id`, `email` unique, `password_hash`, `role` enum `buyer|seller_member|admin`, `created_at`)
  - `seller_members` (`user_id`, `seller_id`, `role` enum `owner|staff`)
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`

Schema note: use PBKDF2 via WebCrypto (Workers-friendly) — not Node `bcrypt` native.

- [ ] **Step 1: Write failing auth tests**

```ts
import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "../auth"

describe("password helpers", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("alkemart-test-1")
    expect(h).not.toContain("alkemart-test-1")
    expect(await verifyPassword("alkemart-test-1", h)).toBe(true)
    expect(await verifyPassword("wrong", h)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd Alkemart4/packages/domain && bun run test src/__tests__/auth.test.ts
```

- [ ] **Step 3: Implement `auth.ts` + users schema + migration generate**

- [ ] **Step 4: Tests PASS + typecheck**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(db): users auth schema and Workers-safe password helpers"
```

---

### Task 2: Paystack client package (named Paystack — not generic)

**Files:**
- Create: `Alkemart4/packages/paystack/package.json`, `src/client.ts`, `src/index.ts`, `src/__tests__/client.test.ts`
- Modify: root/Alkemart4 workspaces

**Interfaces:**
- Consumes: `PAYSTACK_SECRET_KEY`, fetch
- Produces (exact names — Paystack vocabulary):

```ts
export type PaystackConfig = { secretKey: string; baseUrl?: string } // default https://api.paystack.co

export function verifyPaystackWebhookSignature(rawBody: string, signature: string, secret: string): boolean
export function mapMomoProviderToPaystackSlug(provider: "mtn" | "vodafone" | "airteltigo"): "mtn" | "vod" | "atl"
export function assertPaystackAmountMatches(expectedPesewas: bigint, paystackAmount: number): void

export async function createPaystackTransferRecipient(cfg: PaystackConfig, input: {
  name: string
  accountNumber: string // MoMo MSISDN
  bankCode: string      // Paystack MoMo bank code / provider
  currency?: "GHS"
}): Promise<{ recipientCode: string }>

// Charge/initialize used in Plan 3 — stub signatures OK here if tested with fetch mock:
export async function chargePaystackMobileMoney(cfg: PaystackConfig, input: {
  email: string
  amountPesewas: bigint
  phone: string
  provider: "mtn" | "vodafone" | "airteltigo"
  reference: string
}): Promise<{ status: string; reference: string; data: unknown }>
```

**Forbidden:** `interface PaymentProvider`, `charge(provider: string)`, Stripe types.

Reference implementation: `apps/backend/packages/api/src/lib/paystack-client.ts` (copy behavior, not Medusa imports).

- [ ] **Step 1: Failing tests for slug map + amount assert + signature HMAC fixture**

- [ ] **Step 2: Implement client with `paystackRequest` helper**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(paystack): Paystack-only client for MoMo slugs, webhooks, recipients"
```

---

### Task 3: Session JWT middleware + store/vendor/admin register-login

**Files:**
- Create: `apps/api/src/lib/jwt.ts`, `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/routes/store/auth.ts`, `vendor/auth.ts`, `admin/auth.ts` (or shared factory)
- Modify: `apps/api/src/env.ts` — require `JWT_SECRET`; `PAYSTACK_SECRET_KEY` optional until onboarding/charge
- Test: `apps/api/src/routes/store/auth.test.ts` (in-memory user repo)

**Interfaces:**
- `POST /store/auth/register` `{ email, password }` → `{ token, user }`
- `POST /store/auth/login` → `{ token, user }`
- `POST /vendor/auth/register` `{ email, password, sellerName, sellerHandle }` → creates User + Seller(`pending_approval`) + SellerMember + token
- `POST /vendor/auth/login` → token with `sellerId`
- `POST /admin/auth/login` → admin role only (seed one admin in test)
- Middleware: `requireAuth`, `requireSeller`, `requireAdmin` attaching `{ userId, role, sellerId? }`

- [ ] **Step 1: Failing tests — register vendor yields sellerId on token claims; buyer token cannot hit requireSeller**

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "feat(api): JWT auth for store vendor admin actors"
```

---

### Task 4: Seller readiness + Ghana onboarding (Paystack recipient)

**Files:**
- Create: `packages/domain/src/seller-readiness.ts` + tests
- Create: `apps/api/src/routes/vendor/onboarding.ts`
- Modify: `packages/db/src/schema/sellers.ts` — ensure `recipient_code`, `momo_provider`, `momo_phone`, pack address fields
- Test: onboarding route with **mocked** `createPaystackTransferRecipient`

**Interfaces:**
- `evaluateSellerReadiness(seller): { ready: boolean; missing: string[] }`
  - v1 GH: profile name, pack address region, **Paystack recipient_code** (or explicit skip flag for lab only)
- `POST /vendor/onboarding/ghana-setup` body:

```ts
{
  displayName: string
  region: string  // Ghana region id from @alkemart/shared
  digitalAddress?: string
  deliveryFeePesewas: string
  momo: { provider: "mtn" | "vodafone" | "airteltigo"; phone: string; accountName: string }
}
```

  - Calls **only** `createPaystackTransferRecipient`
  - Stores `recipient_code` on seller
  - Returns readiness

- `GET /vendor/onboarding/status` → readiness

Lab: if `PAYSTACK_SECRET_KEY` missing, return 503 with clear message (fail closed) — do not fake recipient codes.

- [ ] **Step 1: Domain readiness tests**

- [ ] **Step 2: Route tests with mock Paystack returning `RCP_test`**

- [ ] **Step 3: Implement + commit**

```bash
git commit -m "feat(vendor): Ghana onboarding with Paystack transfer recipient"
```

---

### Task 5: Vendor product/offer write (seller-scoped)

**Files:**
- Create: `packages/domain/src/moderation.ts` + tests
- Create: `apps/api/src/routes/vendor/products.ts`
- Test: isolation — seller A cannot PATCH seller B offer

**Interfaces:**
- `POST /vendor/products` — create Product (`proposed`) + Offer for auth seller; require `primaryCategoryId` leaf; body prices in pesewas strings
- `PATCH /vendor/products/:id` — only if product linked to auth seller via offer/proposership
- `POST /vendor/products/:id/propose` — status → `proposed`
- `GET /vendor/products` — list own products/offers only

Unique offer constraint enforced by DB.

- [ ] **Step 1: Isolation failing test**

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vendor): seller-scoped product and offer writes"
```

---

### Task 6: Admin seller + product moderation

**Files:**
- Create: `apps/api/src/routes/admin/sellers.ts`, `admin/products.ts`
- Test: approve seller → status `open`; reject product → `rejected`

**Interfaces:**
- `POST /admin/sellers/:id/approve|suspend|unsuspend|terminate`
- `POST /admin/sellers/:id/commission` `{ commissionBps: number }`
- `POST /admin/products/:id/approve|reject|request-changes`
- Approve product → `published` (becomes sellable if offer+seller ready)

- [ ] **Step 1: Tests**

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(admin): seller lifecycle and product moderation"
```

---

### Task 7: OpenAPI + client update + Plan 2 exit checklist

**Files:**
- Modify: `packages/api-spec/openapi.yaml`
- Regenerate/extend `@alkemart/api-client`
- Create: `docs/superpowers/plans/2026-08-31-cloudflare-plan2-exit-checklist.md`

**Exit gates:**

| Gate | Verify |
|---|---|
| Vendor register creates pending seller | test |
| Buyer JWT cannot access `/vendor/*` | test |
| Seller A cannot mutate seller B product | test |
| Ghana setup stores Paystack `recipient_code` from mock | test |
| Missing Paystack key → 503 on ghana-setup | test |
| No generic PaymentProvider type in repo | `rg PaymentProvider packages apps/api` empty |
| Admin approve → seller open + product publish path | test |

- [ ] **Step 1: OpenAPI + client**

- [ ] **Step 2: Checklist doc + `rg` gate**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: Plan 2 identity seller exit checklist and OpenAPI"
```

---

## Spec coverage

| Spec item | Task |
|---|---|
| Paystack-only rails | T2, T4 |
| Multivendor seller isolation | T5, T6 |
| Seller status machine | T3, T6 |
| Ghana readiness + recipient | T4 |
| Product moderation | T5, T6 |
| Auth actors | T3 |
| Checkout MoMo charge | **Plan 3** |

## Placeholder scan

None intentional. Plan 3 owns charge/initialize webhook completion.
