# Lifecycle — Payment

## States (`payment_intents.status`)

`initiated → pending → succeeded → completed`  
Terminals also include `failed | expired | refunded`. Paid online = `succeeded` or `completed` (the intent moves to `completed` once its order exists).

## Paths

### COD

1. `POST /store/checkout` `method=cod` + shipping  
2. Create intent → `confirmPaidOrder` immediately  
3. Return `orderGroupId`

**Settlement (decided 2026-09-25):** the seller's rider collects the cash and
the seller keeps it. COD orders are **never payable** —
`listDeliveredUnpaidOrders` excludes `payment_intents.method = 'cod'`, so no
payout batch or Paystack transfer ever includes them. The seller owes the
commission: `GET /vendor/payouts/statement` reports COD lines as
`state: "cash"` (`netPesewas: 0`, `cashCollectedPesewas`, commission) and
totals `cashCollectedPesewas` / `commissionOwedPesewas`. **Open:** recovering
owed commission (net it off the next online payout, or collect separately)
needs a settlement record — not built yet.

**Open question:** online payouts pay `subtotal − commission`; the buyer's
delivery fee (which the seller sets and fulfils) is never passed to the
seller. Confirm whether that is intended.

### MoMo

1. Create intent `initiated` (Paystack reference set **before** any Paystack HTTP)  
2. **`reserveStock`** (before charge — never debit without a hold)  
3. Mark `pending` → Paystack charge  
4. Confirm via **webhook** (`POST /hooks/paystack`) and/or **status poll** (`GET /store/checkout/status` → verify)  
5. Charge fail / abandon: **`releaseReservations`** + mark `failed` / `expired`

### Card

1. Create intent `initiated`  
2. **`reserveStock`** (before initialize — same ordering as MoMo)  
3. Mark `pending` → Paystack initialize → authorization URL  
4. Callback / webhook / status verify → `confirmPaidOrder`  
5. Init fail / abandon: **`releaseReservations`** + mark `failed` / `expired`

## Confirm rules

- Verify by reference: status `success`, **amount and currency** match the intent  
- Idempotent: second confirm returns existing OrderGroup  
- Webhook HMAC-SHA512 verified; event id deduped in `CATALOG_KV` (fast path only)  
- Multi-seller: one group, N orders, stock decremented per offer line
- **Paid after close** (intent already `expired`/`failed`): no order is created
  (stock was released); the webhook is acknowledged and an
  `alert:paid_after_close` row lands in `paystack_events` for an admin to
  refund (`POST /admin/payouts/refunds`, only when no order exists).

## Expiry asks Paystack first (0039)

Paystack only sends webhooks for **successful** charges, and retries them for
72h — so expiry by clock alone could expire a buyer who paid. The queue
consumer (and the dormant sweep) call `reconcileStaleIntent`: verify by
reference → `success` confirms the order; still in flight waits (retry in
10 min, up to 24h); abandoned / failed / unknown to Paystack expires and
releases stock; Paystack unreachable waits.

## Payout (0039: reserve → send → settle)

**Automatic payouts** (domain `DEFAULT_PAYOUT_POLICY.autoPayout` — **off for
the pilot**; admin pays with "Pay everyone ready"; `lib/payouts.ts`). When
switched on: A seller's released money is sent without an admin
press the moment it is released:
- handover code entered, or the buyer's "I got it" → sent at once (after the
  response, `waitUntil`);
- seller-only "delivered" → an `auto-payout` queue job fires when the report
  window ends (hops of ≤12h, re-published fresh so `max_retries` never drops
  it); the seller opening Money is a backstop that sends anything released;
- "It's sorted", a closed return, or admin releasing a hold → sent;
- a payout confirmed `paid` (webhook or Check) → the next released money is
  sent (one payout in flight per seller). Never re-sent automatically after a
  failure — admin sees those.
Same reserve → send → settle path (actor `system:auto`). Admin → Payouts →
**Pay** / **Pay everyone ready** (`POST /admin/payouts/run`) are the backstop.
Paystack must have "Confirm transfers before sending" (OTP) off, and the
balance must hold the money (a same-day charge may not be settled yet; the
payout then fails as low balance and the next release or admin press
sends it).

1. `POST /admin/payouts` **reserves** the exact payable orders (delivered,
   online, no active hold, not in a payout) into a `pending` payout with one
   Paystack reference (`payout_<uuid>`), in one transaction. An account-level
   hold blocks it (409). One payout in flight per seller.
2. **Send** the transfer with that reference. Paystack's answer:
   `success` → paid; accepted/pending → `processing`; 4xx → `failed` (orders
   freed); timeout/5xx → stays `pending` (unknown — never assumed failed);
   `otp` → flagged (turn off "Confirm transfers before sending").
3. **Settle** by webhook (`transfer.success|failed|reversed`, amount must
   equal the payout net or it's an alert) or `POST /admin/payouts/:id/check`
   (GET `/transfer/verify/:reference`). `paid` writes the ledger `payout`
   row; `failed`/`reversed` delete the payout lines so the orders join the
   next payout; `reversed` also writes a negative `adjustment`.
- Retry (`POST /:id/retry`) is only for `pending` and **reuses the reference**
  (Paystack dedupes it; a new reference could pay twice).
- Every step is a `payout_events` row; sellers see it (admin ids hidden) in
  `GET /vendor/payouts/statement` → `payouts[].steps`, with the failure reason
  and masked MoMo destination. Statement lines in an unconfirmed payout are
  `sending`, not `paid`.
- Every signed webhook is a `paystack_events` row with what we did
  (`GET /admin/payouts/paystack-events`).

## Launch gate

See `docs/ops/PAYMENTS-LAUNCH-GATE.md` for live MoMo/card money matrix. Lab COD is proven; live money must be re-run before public launch.

## Known gaps

- Refunds exist only for paid-after-close checkouts (no order); refunds for
  real orders need a returns flow first  
- Disputes are logged as alerts; no evidence-upload flow yet  

## Async jobs (Queues, not cron)
- Intent create (momo/card) publishes a delayed `intent-expiry` message
  (`delaySeconds` = stale threshold); the consumer CAS-expires stale
  pending/initiated intents + releases stock, acks terminal/COD/mid-confirm
  as noop, and re-schedules early redeliveries for the remaining time.
- Every confirm path (COD, poll, webhook) publishes a `notification-sweep`;
  the consumer runs the idempotent outbox claim (`claimPendingNotifications`).
- At-least-once: redeliveries converge (CAS + claims); poison rides retries
  to the DLQ; producers never throw into the request path (`publishJob`).
- `scheduled()` stays as a dormant compat entrypoint; no cron slots consumed.
  Backstop: `POST /admin/migrate/expire-payment-intents` (admin JWT).

## Money ledger (append-only)

- `ledger_entries(idempotency_key PK, market_code, seller_id, order_id,
  intent_id, kind, amount_minor, currency, created_at)` — every movement is a
  row written in the SAME transaction as the state change it records.
- `confirmPaidOrder` appends `sale` + `platform_fee` per seller order (fee =
  seller's `commissionBps`, integer math); `createPayout` appends `payout`
  (net, currency resolved from the batch's paid intent, asserted uniform).
- Replay converges: confirmed groups early-return, and keys (`sale:{order}`,
  `platform_fee:{order}`, `payout:{id}`) dedupe via `ON CONFLICT DO NOTHING`.
- Currency is ISO-4217 uppercase end-to-end (`Money` domain type; market
  config owns defaults — no `"ghs"` literals in write paths). Disputes are
  answered with `SELECT over ledger_entries`, never code re-execution.

## Refunds on returns (0044)

- Online: when a return closes with money back, the case is closed with the
  refund booked (orders `refunded_pesewas`, ledger `refund` and a negative
  `platform_fee`) **before** Paystack is asked (`POST /refund`, for the full
  item amount). `refund.processed` / `refund.failed` webhooks settle it; admin
  can retry a failed one.
- Payouts pay `subtotal − refunded`; commission follows. If the order was
  already in a payout, the seller's share (`refund − commission share`) is a
  recovery taken from the next payout (`payouts.recovered_pesewas`), oldest
  first, only while it fits; a failed or reversed payout puts it back.
- Pay on delivery: never through Paystack — the seller pays back and records it.
- While a case is open the order's payout is held (buyer hold, released on close).

