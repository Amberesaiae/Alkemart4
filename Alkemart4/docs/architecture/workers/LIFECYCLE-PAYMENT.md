# Lifecycle — Payment

## States (`payment_intents.status`)

`initiated → pending → succeeded → completed`  
Terminals also include `failed | expired | refunded` (refund API not exposed yet).

## Paths

### COD

1. `POST /store/checkout` `method=cod` + shipping  
2. Create intent → `confirmPaidOrder` immediately  
3. Return `orderGroupId`

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

- Amount match against quote / intent  
- Idempotent: second confirm returns existing OrderGroup  
- Webhook HMAC verified; event id deduped in `CATALOG_KV`  
- Multi-seller: one group, N orders, stock decremented per offer line

## Payout

- Admin `POST /admin/payouts` with `sellerId`  
- Eligible: `orders.status = delivered` without `payout_lines`  
- Paystack Transfer using seller `recipient_code` − `commission_bps`

## Launch gate

See `docs/ops/PAYMENTS-LAUNCH-GATE.md` for live MoMo/card money matrix. Lab COD is proven; live money must be re-run before public launch.

## Known gaps

- Refund / partial refund API  
- Chargeback handling  

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
