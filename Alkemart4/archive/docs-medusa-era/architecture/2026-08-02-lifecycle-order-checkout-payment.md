# Order, Checkout & Payment Lifecycle — Detailed

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — as-built |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |
| **Binding money ADRs** | `2026-07-13-alkemart-architecture-and-commercial-spine.md`, `2026-07-15-paystack-ghana-integration.md` |

---

## 1. The Kernel: `lib/ghana-checkout.ts`

Single entry: `runGhanaCheckout(input)` dispatched from `POST /store/ghana-checkout`.

| Function | Role |
|---|---|
| `loadCheckoutCart` | fetch + validate cart |
| `ensureCartBoundToCustomer` | guest→customer binding before completion |
| `normalizeGhanaPhone` | 0XX / 233 / +233 → E.164 (single canonical impl) |
| `ensureSystemPaymentAndCompleteCart` | COD path — `pp_system_default` provider, completes cart |
| `runCodCheckout` | cash on delivery — order created immediately, pay on delivery |
| `runCardCheckout` | Paystack card — sync charge → order on success |
| `runMomoCheckout` | Paystack MoMo — **async**: charge initiated, buyer approves on device |
| `confirmMomoByPaystackReference` | webhook/poll confirmation → completes cart → order |
| `getMomoCheckoutStatus` | polled by storefront via `GET /store/ghana-checkout/status` |
| `CheckoutHttpError` | typed HTTP failures — checkout fails loudly, never silently |

**Invariant: charge-before-order.** No order exists until payment is authorized (or COD explicitly chosen). Cart completion (`completeCartWorkflow`) is the only order-creating door.

## 2. MoMo State Machine (the critical async path)

```
initiated ──charge sent──▶ pending ──buyer approves USSD──▶ charged ──▶ captured (order created)
    │                        │                                  ▲
    │                        │        Paystack webhook ─────────┘
    │                        │        /hooks/paystack:
    │                        │          1. HMAC signature verified
    │                        │          2. event-ID dedup (Redis SETEX, in-mem fallback)
    │                        │          3. charge.success → confirmMomoByPaystackReference
    │                        │
    │                        └──▶ storefront polls /store/ghana-checkout/status meanwhile
    │
    └── abandoned ──▶ momo-payment-ttl job (5-min cadence):
                      initiated|pending|charged older than 30 min → "expired"
                      (cart freed, payment session released; CART module service, no raw SQL)
```

Production notes:
- In Paystack production, MoMo sync responses return `send_otp` / `pay_offline` / `pending` — **success only arrives via webhook**. Any code path that treats the sync response as final is a bug.
- Webhook handler returns 200 fast; retries are absorbed by dedup.
- ⚠️ Task #5: this machinery must be exercised against live Paystack before launch.

## 3. Multi-Vendor Order Splitting

```
one cart (mixed sellers)
  → completeCartWorkflow → Mercur OrderGroup
       ├─ Order (seller A)   ← order_seller link
       └─ Order (seller B)
```

- Buyer sees the group; each vendor sees only their Order (server-side scope).
- Totals, payment, and refunds reference the correct slice via the group.

## 4. Fulfillment (per-vendor)

```
not_fulfilled → partially_fulfilled → fulfilled → shipped → delivered        canceled (terminal)
```

- Vendor mutates via `/vendor/alkemart/orders/[id]/fulfillments` (vendor app `orders/$id.tsx`: toast + refetch per transition).
- Buyer SMS on `shipped` and `delivered` (`order-lifecycle-notify`).

## 5. Cancellation Matrix

| Actor | Mechanism | Constraint |
|---|---|---|
| Vendor | `POST /vendor/alkemart/orders/[id]/cancel` — soft **cancel-request** flag | only while `not_fulfilled`; admin decides |
| Admin | hard cancel via `/admin/orders/[id]` | confirm modal; `order.canceled` → buyer SMS |
| System | MoMo TTL expiry (pre-order) | cart never became an order |

Honest-cancel rules from the commercial spine ADR still bind: refund + stock restore must gate on ship-state (full compensation flow lands with task #4 shipping/inventory configuration).

## 6. Notifications Summary

| Event | Buyer | Vendor |
|---|---|---|
| `order.placed` | SMS + WA confirm | SMS + WA "new order" (per seller) |
| `fulfillment_shipped` | SMS | — |
| `fulfillment_delivered` | SMS | — |
| `order.canceled` | SMS | — |

## 7. Invariants

1. Integer pesewas end-to-end; display conversion only at the UI edge.
2. One phone normalizer per side: backend `normalizeGhanaPhone`/`normalizePhoneForCountry`; vendor-app mirror documents which function it mirrors.
3. Payment provider work goes through `src/modules/paystack` + `lib/paystack-client.ts` — routes never call Paystack HTTP directly.
4. Webhook handlers are idempotent (dedup) and side-effect-safe on retry.
5. New checkout modes plug into `runGhanaCheckout` dispatch — never a parallel checkout route.

## 8. Test Coverage

- `e2e/tests/checkout.spec.ts`, `order-fulfillment.spec.ts`, `refund.spec.ts`
- k6 load suites for checkout surfaces
- Backend unit tests in `packages/api/src/lib/__tests__`
