# Cloudflare Ghana Multivendor Marketplace — Plan 3: Checkout + OrderGroup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-seller cart quote, Paystack MoMo/card/COD PaymentIntent, soft stock reservation, webhook confirm → one OrderGroup + per-seller Orders.

**Architecture:** Hono `/store/cart` + `/store/checkout` + `/hooks/paystack`. Postgres ledger via Hyperdrive primary. Durable Object serializes MoMo intent transitions (in-memory confirm service injectable in tests). Paystack-only — no PaymentProvider.

**Tech Stack:** Hono, Drizzle, Vitest, Zod, `@alkemart/paystack`, Cloudflare Workers DO + KV dedup.

**Spec:** `docs/superpowers/specs/2026-08-31-cloudflare-ghana-marketplace-design.md` (§3.1, §5 Ghana money)

**Depends on:** Plan 1+2 on `main` (`ae79d21`)

**Next:** Plan 4 — fulfillment, payouts, cutover

## Global Constraints

- **Paystack only** — never Stripe/Flutterwave/`PaymentProvider`
- Pesewas `bigint`/string in APIs; Paystack amounts are pesewas
- Cart lines bind **`offerId`** only (never product-only ATC)
- On success: **one OrderGroup + N Orders** (one per seller); lines keep `sellerId` + `offerId`
- Soft hold: `reserved` on offer while MoMo pending; release on fail/expire; commit on complete
- Webhook HMAC + idempotent confirm (unique Paystack reference)
- COD creates orders immediately (no Paystack)
- Fail-closed missing `PAYSTACK_SECRET_KEY` on MoMo/card (503)
- Nested paths under worktree `Alkemart4/`

---

### Task 1: Checkout schema + migrations

**Files:**
- Create: `packages/db/src/schema/carts.ts`, `payments.ts`, `orders.ts`
- Modify: `packages/db/src/schema/index.ts`
- Generate: migration `0003_*.sql` via drizzle-kit

**Schema (exact):**

```ts
// carts.ts
carts: id, currency default ghs, buyerEmail nullable, createdAt
cartItems: id, cartId, offerId, sellerId, qty int, unique(cartId, offerId)

// payments.ts
paymentIntentStatusEnum: initiated|pending|succeeded|completed|failed|expired|refunded
paymentIntents: id, cartId, method enum momo|card|cod, status, amountPesewas bigint,
  currency default ghs, paystackReference unique nullable, buyerEmail,
  momoProvider nullable, momoPhone nullable, createdAt, updatedAt
stockReservations: id, paymentIntentId, offerId, qty, createdAt
  unique(paymentIntentId, offerId)

// orders.ts
orderGroups: id, paymentIntentId unique, buyerEmail, totalPesewas, currency, createdAt
orders: id, orderGroupId, sellerId, subtotalPesewas, deliveryFeePesewas, status default placed
orderItems: id, orderId, offerId, sellerId, productId, title, qty, unitPricePesewas
```

- [ ] **Step 1:** Add schema files + export from index
- [ ] **Step 2:** `bunx drizzle-kit generate` (or package script); commit SQL even if live migrate skipped
- [ ] **Step 3:** Commit `feat(db): carts payment intents orders schema`

---

### Task 2: Domain quote + payment transitions

**Files:**
- Create: `packages/domain/src/checkout.ts` + `__tests__/checkout.test.ts`
- Modify: `packages/domain/src/index.ts`

**Produces:**

```ts
export type QuoteLine = {
  offerId: string
  sellerId: string
  qty: number
  unitPricePesewas: bigint
  lineTotalPesewas: bigint
}
export type SellerQuote = {
  sellerId: string
  lines: QuoteLine[]
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  sellerTotalPesewas: bigint
}
export type CartQuote = {
  sellers: SellerQuote[]
  totalPesewas: bigint
  currency: "ghs"
}

export function quoteCart(
  lines: Array<{
    offerId: string
    sellerId: string
    qty: number
    unitPricePesewas: bigint
    deliveryFeePesewas: bigint
  }>,
): CartQuote

export type PaymentIntentStatus =
  | "initiated" | "pending" | "succeeded" | "completed" | "failed" | "expired" | "refunded"

export function assertPaymentTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void
// allowed: initiated→pending|failed|expired|completed(COD);
// pending→succeeded|failed|expired; succeeded→completed|refunded
```

Tests: two-seller quote sums delivery once per seller; invalid transition throws.

- [ ] **Step 1:** Failing tests
- [ ] **Step 2:** Implement
- [ ] **Step 3:** Commit `feat(domain): cart quote and payment intent transitions`

---

### Task 3: Paystack initialize + verify

**Files:**
- Modify: `packages/paystack/src/client.ts`, `index.ts`, `__tests__/client.test.ts`

**Produces (exact names):**

```ts
export async function initializePaystackTransaction(cfg: PaystackConfig, input: {
  email: string
  amountPesewas: bigint
  reference: string
  callbackUrl: string
}): Promise<{ authorizationUrl: string; reference: string; accessCode: string }>

export async function verifyPaystackTransaction(cfg: PaystackConfig, reference: string): Promise<{
  status: string
  amount: number
  reference: string
  raw: unknown
}>
```

`GET /transaction/verify/:reference`, `POST /transaction/initialize`. Amounts as Number(pesewas). No PaymentProvider.

- [ ] **Step 1:** Failing tests with fetch mock
- [ ] **Step 2:** Implement
- [ ] **Step 3:** Commit `feat(paystack): initialize and verify transactions`

---

### Task 4: Cart + checkout API (COD + MoMo)

**Files:**
- Create: `apps/api/src/checkout-repository.ts`
- Create: `apps/api/src/routes/store/cart.ts`, `cart.test.ts`
- Create: `apps/api/src/routes/store/checkout.ts`, `checkout.test.ts`
- Create: `apps/api/src/lib/checkout-confirm.ts` (pure confirm used by webhook + COD)
- Modify: `apps/api/src/index.ts`, `context.ts`, `env.ts` as needed
- Optional DO stub: `apps/api/src/momo-intent-do.ts` — real DO class + wrangler binding; tests inject `confirmCheckout` fn

**Interfaces:**

- `POST /store/cart` → `{ cartId }`
- `POST /store/cart/:id/items` `{ offerId, qty }` — validates sellable offer; stores sellerId from offer
- `GET /store/cart/:id` → lines + `quote` via `quoteCart`
- `POST /store/checkout` body:
  - `{ cartId, method: "cod", buyerEmail }` → PaymentIntent completed + OrderGroup immediately
  - `{ cartId, method: "momo", buyerEmail, momo: { provider, phone } }` → chargePaystackMobileMoney; pending + reservations; 503 if no key
  - `{ cartId, method: "card", buyerEmail, callbackUrl }` → initializePaystackTransaction; return authorizationUrl

**Confirm (idempotent):** given succeeded intent + verified amount → create OrderGroup/Orders/Items; decrement `on_hand`, clear reservations; set intent `completed`. Second call no-ops.

Tests (in-memory repos + mocked Paystack):
1. Two-seller COD → 1 OrderGroup, 2 Orders
2. MoMo pending reserves stock (`available` drops)
3. Missing Paystack key → 503 on momo

- [ ] **Step 1:** Failing tests
- [ ] **Step 2:** Implement
- [ ] **Step 3:** Commit `feat(api): multi-seller cart checkout COD and MoMo`

---

### Task 5: Paystack webhook + OpenAPI + exit checklist

**Files:**
- Create: `apps/api/src/routes/hooks/paystack.ts`, `paystack.test.ts`
- Modify: `packages/api-spec/openapi.yaml`, regenerate `@alkemart/api-client`
- Create: `docs/superpowers/plans/2026-08-31-cloudflare-plan3-exit-checklist.md`

**Webhook `POST /hooks/paystack`:**
1. Verify HMAC (`verifyPaystackWebhookSignature`) — 401 if bad
2. KV dedup by event id/reference (injectable Map in tests)
3. `verifyPaystackTransaction` + `assertPaystackAmountMatches`
4. Transition pending→succeeded→completed via confirm (OrderGroup)
5. Return 200 fast

**Exit gates:**

| Gate | Verify |
|---|---|
| Cart item requires offerId | test |
| Two-seller COD → OrderGroup + 2 orders | test |
| MoMo reserves stock while pending | test |
| Webhook HMAC reject | test |
| Webhook success creates orders idempotently | test |
| `rg PaymentProvider packages apps/api` empty | cmd |
| No charge without Paystack key (503) | test |

- [ ] **Step 1:** Webhook tests + impl
- [ ] **Step 2:** OpenAPI + client + checklist
- [ ] **Step 3:** Commit `docs: Plan 3 checkout exit checklist and OpenAPI`

---

## Spec coverage

| Spec item | Task |
|---|---|
| ATC offer_id | T4 |
| Multi-seller quote | T2, T4 |
| Paystack MoMo/card | T3, T4 |
| COD exception | T4 |
| Webhook + idempotent order | T5 |
| OrderGroup split | T4, T5 |
| Soft reservation | T1, T4 |
| Paystack-only | all |

## Placeholder scan

None. Plan 4 owns fulfillment/payouts/SMS.
