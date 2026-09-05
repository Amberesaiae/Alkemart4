# Paystack Ghana Integration Runbook (Medusa)

| Field | Value |
|---|---|
| **Date** | 2026-07-15 |
| **Status** | Production readiness (P2) — code landed; staging E2E sign-off required |
| **Stack** | Medusa v2 backend under `alkemart-medusa/apps/backend` |
| **Primary rail** | Ghana Mobile Money (MTN / Vodafone / AirtelTigo) via Paystack Charge API |
| **Secondary rail** | Cash on delivery (COD) via Medusa `pp_system_default` |
| **Related** | Commercial spine ADRs (`2026-07-13-…`), production plan P2 (`docs/superpowers/plans/2026-07-15-alkemart-neon-medusa-paystack-production-plan.md`) |

This document is the **ops + engineering runbook** for Ghana payments on Medusa. It describes what ships today, how money units convert, how to configure keys/webhooks, the staging E2E matrix, and recovery procedures.

---

## 1. Architecture

### 1.1 Happy path (text diagram)

```
┌─────────────┐     POST /store/ghana-checkout      ┌──────────────────────┐
│  SPA        │ ──────────────────────────────────► │ Medusa store API     │
│  (checkout) │   { cart_id, payment_method,        │ ghana-checkout route │
│             │     email, phone, momo_provider }   └──────────┬───────────┘
└─────────────┘                                                │
       ▲                                                       ▼
       │                                          ┌────────────────────────┐
       │  200 completed | 202 payment_pending     │ lib/ghana-checkout.ts  │
       │                                          │  COD  → system pay +   │
       │                                          │         completeCart   │
       │                                          │  MoMo → intent first   │
       │                                          └──────────┬─────────────┘
       │                                                     │
       │                    ┌────────────────────────────────┼────────────────┐
       │                    │ ADR-014                        ▼                │
       │                    │              payments-ghana: createInitiated     │
       │                    │              (client_reference UUID, amount      │
       │                    │               pesewas, expires_at, metadata)     │
       │                    │                                │                │
       │                    │                                ▼                │
       │                    │              Paystack POST /charge               │
       │                    │              mobile_money { phone, provider }    │
       │                    │              amount = pesewas, ref = client_ref  │
       │                    │                                │                │
       │                    │              attachProviderReference             │
       │                    │                                │                │
       │                    │         ┌──────────────────────┴──────────┐     │
       │                    │         ▼                                 ▼     │
       │                    │   status=success                    pending /   │
       │                    │   (sandbox common)                  send_otp /  │
       │                    │         │                           pay_offline │
       │                    │         │                                 │     │
       │                    │         ▼                                 ▼     │
       │                    │   confirmPaid…                    return 202    │
       │                    │   (verify + completeCart)         payment_pending│
       │                    └─────────────────────────────────────────────────┘
       │                                                     │
       │                                                     │ buyer approves
       │                                                     │ USSD / prompt
       │                                                     ▼
       │                                          ┌────────────────────────┐
       │                                          │ Paystack               │
       │                                          │ charge.success webhook │
       │                                          └──────────┬─────────────┘
       │                                                     │
       │              POST /hooks/paystack                    │
       │              x-paystack-signature (HMAC-SHA512)     │
       │                                                     ▼
       │                                          confirmPaidByProviderReference
       │                                            1. find intent by ref
       │                                            2. verify transaction
       │                                            3. assert amount match
       │                                            4. markSucceeded
       │                                            5. system payment session
       │                                            6. completeCartWorkflow
       │                                                     │
       └──────────── poll / refresh UI ◄── order_id on success ─┘
```

### 1.2 COD path (short)

```
SPA → POST /store/ghana-checkout { payment_method: "cod" }
    → ensureSystemPaymentAndCompleteCart (pp_system_default)
    → completeCartWorkflow
    → 200 { status: "completed", order_id, cart_id }
```

No Paystack call. No payment intent row (COD does not use `payments-ghana`).

### 1.3 Design rules (binding)

| Rule | Implementation |
|---|---|
| **Intent before HTTP (ADR-014)** | `createInitiated` runs before `chargeMobileMoney` |
| **Orders only via Medusa** | `completeCartWorkflow` — never custom order inserts |
| **Cart not completed until paid (MoMo)** | Pending charges return 202; webhook/sync confirm completes cart |
| **Idempotent confirm** | `succeeded` + `order_id` short-circuits to same order |
| **Amount invariant** | Verify path requires Paystack pesewas == intent `amount_pesewas` |
| **Complete-cart failure after capture** | Best-effort `refundCharge`; metadata records refund outcome |

---

## 2. Money: pesewas vs major GHS vs Paystack

| Layer | Unit | Example (GH₵ 25.50) |
|---|---|---|
| **Medusa store / cart `total`** | **Major GHS** (decimal-capable number) | `25.5` |
| **payments-ghana intent `amount_pesewas`** | **Integer pesewas** (minor) | `2550` |
| **Paystack Charge / Verify / Refund `amount`** | **Integer pesewas** for GHS | `2550` |
| **Alkemart Express / SPA legacy** | Integer pesewas in DB/API | `2550` |

### 2.1 Conversion (single source of truth)

```
// Medusa major → Paystack / intent pesewas
pesewas = Math.round(majorGhs * 100)     // toPaystackAmountPesewas

// Paystack pesewas → Medusa major
major   = pesewas / 100                    // fromPaystackAmountMajor
```

Helpers live in:

`alkemart-medusa/apps/backend/src/lib/paystack-client.ts`

- `toPaystackAmountPesewas(amount, currencyCode)`
- `fromPaystackAmountMajor(amountPesewas, currencyCode)`
- `assertPaystackAmountMatches(paystackPesewas, intentPesewas)` — strict integer equality

### 2.2 Failure modes to avoid

| Mistake | Symptom | Guard |
|---|---|---|
| Double ×100 | Buyer charged 100× | Unit tests + amount match assert |
| Seed products in pesewas into Medusa prices | Catalog shows 100× | `seed-ghana.ts` uses major units; ETL `money.ts` |
| Comparing major to pesewas on webhook | False amount mismatch + refund | Always convert cart total once at intent create |
| Non-integer pesewas | Paystack / assert throws | `Math.round` + integer checks |

---

## 3. MoMo provider slugs

| SPA / API (`momo_provider`) | Paystack `mobile_money.provider` | Notes |
|---|---|---|
| `mtn` | `mtn` | MTN Mobile Money |
| `vodafone` | `vod` | Vodafone Cash (Telecel branding in market) |
| `airteltigo` | `atl` | AirtelTigo Money |

Mapping: `mapMomoProviderToPaystackSlug` / `PAYSTACK_MOMO_PROVIDER_SLUGS` in `paystack-client.ts`.

Do **not** send UI names (`vodafone`, `airteltigo`) to Paystack — only the three-letter/short slugs above.

---

## 4. Environment variables

| Variable | Required | Role |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | **Yes in production**; optional in dev | Charge, verify, refund, **and webhook HMAC**. Also gates Medusa payment-provider registration. |
| `PAYSTACK_PUBLIC_KEY` | Recommended | Passed into Paystack provider options; useful for any client-side Paystack JS later. Not used for HMAC. |
| `PAYMENT_PENDING_TTL_MINUTES` | Optional (default **30**, clamp **10–120**) | Intent `expires_at` for MoMo pending; TTL job marks expired. |
| `DEFAULT_CURRENCY` | Optional (`ghs`) | Store default; cart currency still wins at charge time. |

Validated at boot by `src/lib/env.ts`:

- Production **refuses** boot without `PAYSTACK_SECRET_KEY`.
- There is **no** `PAYSTACK_WEBHOOK_SECRET` — Paystack signs with the **secret key**.

Template: `alkemart-medusa/apps/backend/.env.template`.

### 4.1 When secret key is set

`medusa-config.ts` registers:

```
@medusajs/medusa/payment
  └─ provider id "paystack" → ./src/modules/paystack
```

**Note:** The live Ghana MoMo store path does **not** depend on Medusa’s payment-session authorize for Paystack. It uses:

1. Custom module `payments-ghana` (intent ledger)
2. `lib/paystack-client.ts` (HTTP)
3. `lib/ghana-checkout.ts` (orchestration)
4. Medusa **system** provider only at `completeCart` time (`pp_system_default`)

The `src/modules/paystack` AbstractPaymentProvider remains available for standard Medusa payment flows / future card, but **P2 production MoMo is the ghana-checkout path**.

---

## 5. HTTP surfaces

### 5.1 Store checkout

```http
POST /store/ghana-checkout
x-publishable-api-key: <publishable key>
Content-Type: application/json

{
  "cart_id": "cart_...",
  "payment_method": "cod" | "momo",
  "email": "buyer@example.com",
  "phone": "0244123456",
  "momo_provider": "mtn" | "vodafone" | "airteltigo"
}
```

| Result | Status | Body |
|---|---|---|
| COD or MoMo sync success | **200** | `{ status: "completed", order_id, cart_id }` |
| MoMo async pending | **202** | `{ status: "payment_pending", cart_id, payment_intent_id, client_reference, provider_reference, expires_at, amount_pesewas }` |
| Validation / cart not ready | **400** | `{ error }` |
| Payment declined / amount issues | **402** | `{ error }` |
| Cart already completed | **409** | `{ error }` |
| Cart missing | **404** | `{ error }` |

Prerequisites on cart: line items, shipping address, not already completed, total &gt; 0 for MoMo.

### 5.2 Webhook

```http
POST /hooks/paystack
x-paystack-signature: <hex HMAC-SHA512 of raw body using PAYSTACK_SECRET_KEY>
Content-Type: application/json

{
  "event": "charge.success",
  "data": {
    "reference": "...",
    "amount": 2550,
    "currency": "GHS",
    "status": "success",
    "metadata": { ... }
  }
}
```

| Outcome | HTTP |
|---|---|
| Bad / missing signature | **401** `{ error: "Invalid Paystack signature" }` |
| Missing secret key | **500** |
| Valid signature (incl. business errors after log) | **200** `{ received: true }` |
| Non-`charge.success` events | **200** ack, no side effects |

Raw body preservation is required for HMAC:

- Middleware: `src/api/middlewares.ts` → `preserveRawBody: true` on `/hooks/paystack`
- Handler prefers `req.rawBody`; falls back to `JSON.stringify(req.body)` (less ideal)

### 5.3 Charge request shape (server → Paystack)

```http
POST https://api.paystack.co/charge
Authorization: Bearer sk_test_... | sk_live_...
Content-Type: application/json

{
  "amount": 2550,
  "email": "buyer@example.com",
  "currency": "GHS",
  "reference": "<client_reference UUID>",
  "mobile_money": {
    "phone": "0244123456",
    "provider": "mtn"
  },
  "metadata": {
    "payment_intent_id": "<intent id>",
    "client_reference": "<same UUID>",
    "cart_id": "cart_..."
  }
}
```

| `data.status` | Action |
|---|---|
| `success` | Attach ref → `confirmPaidByProviderReference` → order |
| `pending` / `send_otp` / `pay_offline` | Attach ref → **202** pending |
| other / API error | Mark intent failed → **402** |

---

## 6. Staging vs live keys

| Environment | Secret | Public | Webhook URL |
|---|---|---|---|
| **Local / staging** | `sk_test_…` | `pk_test_…` | Public HTTPS tunnel or staging host → `https://<host>/hooks/paystack` |
| **Production** | `sk_live_…` | `pk_live_…` | Production Medusa origin → `https://<prod-host>/hooks/paystack` |

Rules:

1. Never mix test charges with live webhooks (or vice versa) — signature and data won’t line up.
2. Staging Neon + `sk_test_` is the **only** place to run the full E2E matrix below.
3. Live keys go live only at cutover (plan P7), after matrix sign-off.
4. Rotate secret key carefully: webhook HMAC and API auth both use it; deploy new key atomically with Paystack dashboard.

---

## 7. Paystack Dashboard setup

1. **Create / open** Paystack business (Ghana).
2. **Settings → API Keys & Webhooks**
   - Copy **Test** secret + public for staging; **Live** for production.
3. **Register webhook URL**
   - Staging: `https://<staging-medusa-host>/hooks/paystack`
   - Production: `https://<prod-medusa-host>/hooks/paystack`
   - Events: at minimum **`charge.success`** (handler only acts on this today).
4. **Currency**
   - Business / transactions must support **GHS**.
   - Charge body always sends `"currency": "GHS"` (from cart `currency_code`, uppercased).
5. **Mobile money**
   - Ensure Ghana MoMo channels are enabled for the account.
   - Use Paystack’s documented **test phone numbers** for sandbox MoMo (see Paystack docs; numbers change over time — do not hardcode production phones in tests).
6. **Verify webhook**
   - Send a test event or run a real test charge; confirm **200** and logs without 401.
7. **TLS / reachability**
   - Paystack must reach the public URL; localhost needs a tunnel (ngrok, Cloudflare, etc.).

---

## 8. E2E test matrix (staging)

Run against **staging Medusa + Neon + `sk_test_`**. Do not invent live Paystack calls without keys. Unit layer already covers crypto/money without network (`paystack-client.unit.spec.ts`).

| # | Case | How to exercise | Expected |
|---|---|---|---|
| 1 | **MoMo sync success** | Test MoMo that returns immediate `success` | **200** `completed` + Medusa `order_id`; intent `succeeded` with `order_id` |
| 2 | **Pending + webhook** | Charge returns `pending`/`send_otp`/`pay_offline`; approve / fire `charge.success` | Checkout **202** `payment_pending`; after webhook, intent succeeded + cart completed; **one** order |
| 3 | **Decline** | Invalid phone / declined test path | **402**; intent `failed` (or failed after charge error); **no** order |
| 4 | **Bad signature** | POST `/hooks/paystack` with wrong `x-paystack-signature` | **401**; no intent/order change |
| 5 | **Double webhook** | Deliver same `charge.success` twice | Still **one** order; second confirm is idempotent; both HTTP **200** |
| 6 | **TTL expire** | Set short `PAYMENT_PENDING_TTL_MINUTES` (e.g. 10); leave pending; wait for job | Intent `expired`; **no** order; cart still completable via new checkout |
| 7 | **COD** | `payment_method: "cod"` without Paystack keys (dev) or with keys | **200** completed order; **no** Paystack charge |
| 8 | **Amount mismatch** *(ops / forced)* | Intent amount ≠ verify amount (simulate or corrupt carefully) | Refund attempted; intent failed; **no** order; webhook still **200** after handle |

### 8.1 Suggested manual checklist notes

- Capture `payment_intent_id`, `client_reference`, `provider_reference` from 202 responses for log correlation.
- Confirm Paystack dashboard transaction amount (pesewas) equals cart major × 100.
- Confirm Medusa admin/order API shows the order only after confirm path.
- After double webhook, query intents: single row, single `order_id`.

### 8.2 Automated coverage (already present)

| Layer | File | Covers |
|---|---|---|
| Unit | `src/lib/__tests__/paystack-client.unit.spec.ts` | major↔pesewas, slugs mtn/vod/atl, amount match, HMAC accept/reject, charge/refund with mocked fetch |

Integration tests against live sandbox require `PAYSTACK_SECRET_KEY` and are **not** invented here without credentials.

---

## 9. Recovery procedures

### 9.1 Orphan / stuck intents

| Symptom | Likely cause | Action |
|---|---|---|
| Intent `initiated`, no `provider_reference`, age &gt; few minutes | Crash after create, before charge response | Inspect logs; if no Paystack txn with `metadata.payment_intent_id` / `client_reference`, mark failed or let TTL expire. If Paystack shows a charge, attach ref and run confirm or refund. |
| Intent `pending`, Paystack **success**, no order | Webhook missed / downtime | Call `verify` for `provider_reference`; if success, run same path as webhook (`confirmPaidByProviderReference`). Ops may re-deliver webhook from dashboard. |
| Intent `pending`, Paystack **failed**/abandoned | Buyer never approved | TTL job marks `expired`; buyer retries checkout (new intent). |
| Intent `succeeded` without `order_id` | Extremely rare race/crash mid-confirm | Check Paystack success + cart state; complete cart if still open **or** refund if cart already consumed/broken. |

**Automated today:**

- Job `src/jobs/payment-intent-ttl.ts` (every minute) → `abandonExpiredIntents` marks `initiated`/`pending` past `expires_at` as `expired`. Does **not** call Paystack refund (no capture assumed for pure abandon; if Paystack later succeeds after expire, see 9.2).

**Not fully automated yet (P2 follow-up / ops):**

- Dedicated “orphan reconcile” worker that scans `initiated` without reference and queries Paystack by metadata.
- Buyer-facing `POST /store/ghana-checkout/refresh` poll endpoint (plan optional).

Until then: **manual reconcile** via Paystack dashboard + verify API + re-fire webhook or temporary admin script calling `confirmPaidByProviderReference`.

### 9.2 Late success after TTL / expired intent

If Paystack reports success after local intent is `expired`/`failed`:

1. **Do not** create a second cart/order blindly.
2. Prefer **refund** the Paystack charge (money back to buyer).
3. Log/alert for ops; metadata should record reason.
4. Buyer places a fresh checkout if they still want the goods.

Current `confirmPaidByProviderReference` does not special-case expired-then-success as hard as the commercial spine ADR; treat late success as **ops-critical** until hardened in P4.

### 9.3 Refund after completeCart failure

Already in code (`confirmPaidByProviderReference`):

1. Paystack verify success + amount match → `markSucceeded`
2. `ensureSystemPaymentAndCompleteCart` throws
3. `refundCharge({ reference, amountPesewas })` best-effort
4. Intent marked `failed` with metadata:
   - `complete_cart_failed`, `complete_cart_error`
   - `refund_attempted`, `refund_ok`, `refund_error`

| Refund result | Ops action |
|---|---|
| `refund_ok: true` | Buyer refunded; fix cart/stock issue; buyer retries |
| `refund_ok: false` | **Manual Paystack refund required**; money captured without order — highest severity |

### 9.4 Amount mismatch

On verify, if amounts differ:

1. Refund full verified amount
2. Mark intent failed + `amount_mismatch` metadata
3. No order

Investigate double-conversion or tampered cart totals.

---

## 10. What code already exists

Paths relative to repo root; Medusa app root = `alkemart-medusa/apps/backend`.

| Path | Role |
|---|---|
| `src/lib/paystack-client.ts` | HMAC, amount convert, charge MoMo, verify, refund, provider slugs |
| `src/lib/ghana-checkout.ts` | COD + MoMo orchestration, confirmPaid, TTL abandon, completeCart |
| `src/lib/env.ts` | Zod env; production requires `PAYSTACK_SECRET_KEY` |
| `src/lib/__tests__/paystack-client.unit.spec.ts` | Unit tests (no live keys required) |
| `src/api/store/ghana-checkout/route.ts` | `POST /store/ghana-checkout` SPA contract |
| `src/api/hooks/paystack/route.ts` | `POST /hooks/paystack` webhook |
| `src/api/middlewares.ts` | `preserveRawBody` for webhook HMAC |
| `src/modules/payments-ghana/` | Custom module: payment intent model + service |
| `src/modules/payments-ghana/models/payment-intent.ts` | Intent schema (pesewas, refs, status, expires) |
| `src/modules/payments-ghana/service.ts` | createInitiated, attach ref, mark status, finders |
| `src/modules/paystack/` | Medusa `AbstractPaymentProvider` (registered when secret set) |
| `src/jobs/payment-intent-ttl.ts` | Cron expire pending/initiated intents |
| `medusa-config.ts` | Conditional Paystack payment provider registration |
| `.env.template` | Documented Paystack + TTL vars |

Express reference implementation (legacy, still useful as behavior source):

| Path | Role |
|---|---|
| `artifacts/api-server/src/lib/paystack.ts` | Original charge/refund helpers |
| `artifacts/api-server/src/routes/webhooks.ts` | Express webhook path |
| `lib/db/src/schema/payment-intents.ts` | Express Drizzle intent table |

---

## 11. Intent status machine (payments-ghana)

```
                createInitiated
                      │
                      ▼
                 initiated ──────────────────► failed
                      │  (charge error)           ▲
                      │                           │
          attachProviderReference                 │
                      │                           │
                      ▼                           │
                   pending ────── decline/error ──┘
                      │
          confirm success path
                      │
                      ▼
                  succeeded (+ order_id)
                      │
TTL past expires_at on initiated|pending
                      │
                      ▼
                   expired
```

Statuses: `initiated` | `pending` | `succeeded` | `failed` | `expired`.

---

## 12. Operational monitoring (minimum)

| Signal | Why |
|---|---|
| Webhook **401** rate | Wrong secret or body parsing breaking HMAC |
| Webhook handler errors in logs | completeCart / verify failures after valid signature |
| Intents stuck `pending` &gt; TTL | Job down or clock skew |
| Metadata `refund_ok: false` | **Pager** — captured money without durable order |
| Paystack dashboard success without local order | Missed webhook / orphan |
| Amount mismatch count | Money conversion bug |

---

## 13. Known gaps / follow-ups

| Item | Status | Plan phase |
|---|---|---|
| Staging E2E matrix sign-off with real `sk_test_` | Ops pending | P2 DoD |
| Inventory reservation on pending MoMo | Documented risk (oversell window); short TTL mitigates | P4 / ADR-P2 |
| Orphan reconcile job (Paystack list by metadata) | Manual ops | P2 follow-up |
| SPA pending poll / refresh endpoint | Optional | P2 / P5 |
| Live keys + live webhook | Cutover only | P7 |
| Vendor settlements / Paystack Transfer | Out of scope for charge path | P6 |

---

## 14. Quick start (engineer)

```bash
cd alkemart-medusa/apps/backend
cp .env.template .env
# set DATABASE_URL, JWT/COOKIE secrets, CORS, ALKEMART_* ids
# set PAYSTACK_SECRET_KEY=sk_test_... PAYSTACK_PUBLIC_KEY=pk_test_...

npm run dev   # or project-equivalent medusa develop

# Unit tests (no live Paystack required)
npx jest src/lib/__tests__/paystack-client.unit.spec.ts
```

Register webhook to public URL ending in `/hooks/paystack`, then run matrix §8.

---

## 15. SPA contract (stable)

```
POST /store/ghana-checkout
Headers: x-publishable-api-key
Body: {
  cart_id,
  payment_method: "cod" | "momo",
  email?,              // required momo
  phone?,              // required momo
  momo_provider?       // mtn | vodafone | airteltigo when momo
}

200 { status: "completed", order_id, cart_id }
202 { status: "payment_pending", cart_id, payment_intent_id,
      client_reference, provider_reference, expires_at, amount_pesewas }
4xx/5xx { error: string }
```

Cart must already have shipping address and line items (Medusa cart APIs). MoMo does not complete the cart until Paystack success (sync or webhook).
