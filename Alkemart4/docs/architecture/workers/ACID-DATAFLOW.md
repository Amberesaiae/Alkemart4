# ACID dataflow — Workers

Doctrine: [`AGNOSTIC-APPROACH.md`](./AGNOSTIC-APPROACH.md). This file is the **data-plane** map (bindings, tables, transactions).

## Topology

| Binding / service | Role |
|-------------------|------|
| `HYPERDRIVE` | Catalog / category / seller **pure reads** (query cache allowed) |
| `HYPERDRIVE_PRIMARY` | Auth, cart, checkout, stock, orders, payouts **and all catalog mutations** (vendor product create/patch/propose, admin moderation) + their read-backs (read-after-write; no query cache) |
| `CATALOG_KV` | Hot catalog cache + Paystack webhook event dedup |
| Paystack | MoMo charge, card initialize/verify, transfers, webhook HMAC |
| Pages UIs | UX only — no ledger |

**Known failure mode (do not reintroduce):** catalog writes that run on the cached `HYPERDRIVE` binding can read back a pre-write snapshot (Hyperdrive query cache TTL ≈ 60s), producing intermittent `failed to create vendor product` 500s in production while local (no query cache) works. Keep insert→read-back pairs on the primary binding.

**Rule:** Money and stock mutate only through Workers + primary Hyperdrive. No dual writers. Medusa is archived.

## Concurrency hardening (as built)

| Concern | Mechanism |
|---------|-----------|
| Stock oversell | `reserveStock` uses one atomic conditional `UPDATE offers SET reserved = reserved + q WHERE on_hand - reserved >= q RETURNING id` per line inside the tx — no check-then-act window |
| Intent state machine races (webhook vs status poll vs expiry cron) | `updatePaymentIntentStatus` is compare-and-swap (`WHERE status = observed`); the loser throws instead of silently overwriting |
| Concurrent add-to-cart | `addCartItem` is a single `INSERT … ON CONFLICT (cart_id, offer_id) DO UPDATE SET qty = qty + excluded.qty` — no duplicate rows, no lost increments |
| Double confirm (webhook + poll) | `confirmPaidOrder` pre-checks, then the `order_groups.payment_intent_id` unique constraint arbitrates; the loser re-fetches and returns the winner's group (200, not 500) |
| Double payout | eligibility re-validated inside the `createPayout` tx; `payout_lines.order_id` unique is the final arbiter; a ledger failure after a successful transfer returns 502 with the transfer reference for reconciliation |
| Charge without ledger row | checkout creates the intent row (`initiated`, Paystack reference) **before** calling Paystack; Paystack errors mark it `failed` |
| Charge/redirect without stock | MoMo and card **`reserveStock` before** Paystack charge/initialize; charge/init failure releases the hold and marks the intent `failed` |
| Abandoned reservations | hourly cron (`[triggers]` in wrangler.toml → `runPaymentIntentExpiry`) flips stale pending momo/card intents (>60 min) to `expired` and releases stock. Free-tier fallback: `POST /admin/migrate/expire-payment-intents` (admin JWT) when cron slots are exhausted (API 10072) |
| Connection lifecycle | postgres clients are created **per request** — Workers forbids reusing request-context sockets across requests; over Hyperdrive the per-request cost is a local handshake, not a new Postgres connection |
| Read amplification | listings use a targeted slice (published products + offers/variants by id, 0028 indexes) instead of the 16-table snapshot; `quote`/cart views use one batched join instead of per-item queries |
| Transient pooler blips | read-only slices retry (≤3, backoff) on connection-level errors only (`withTransientRetry`); constraint/query errors never retry |

## Entity model (Postgres)

| Area | Tables |
|------|--------|
| Identity | `users`, `seller_members` |
| Seller | `sellers` |
| Catalog | `markets`, `categories`, `products`, `product_variants`, `offers` |
| Cart | `carts`, `cart_items` |
| Payment | `payment_intents` (+ `shipping_address` jsonb), `stock_reservations` |
| Order | `order_groups`, `orders`, `order_items` |
| Money-out | `payouts`, `payout_lines` |
| Unused by API yet | `returns` |

### Domain facts

- Catalog is **Product ≠ Offer**. ATC binds **`offerId` only**.
- Checkout creates a **payment intent**; success materializes an **OrderGroup** + per-seller **orders**.
- Amounts are **pesewas** (integer). Never float GHS in the ledger.
- Seller readiness gates Ghana MoMo recipient + pack region before sellable listing.

## Middleware stack (`apps/api`)

1. CORS (`ALLOWED_ORIGINS` + default Pages/localhost)  
2. Security headers + best-effort rate limit (auth/checkout/hooks)  
3. Bind catalog / checkout / auth repositories from Hyperdrive  
4. Route mounts: `/store/*`, `/vendor/*`, `/admin/*`, `/hooks/paystack`

## ACID hotspots

| Op | Must be transactional |
|----|------------------------|
| `reserveStock` | Increment `offers.reserved` + insert `stock_reservations` |
| `releaseReservations` | Decrement reserved + delete rows |
| `confirmPaidOrder` | OrderGroup + orders + items + stock decrement + intent `completed`; **idempotent** if group exists |
| `createPayout` | `payouts` + `payout_lines` with unique order line |

## Request path sketch

```
Buyer UI ──► POST /store/checkout
               │
               ├─ COD ──► confirmPaidOrder (tx)
               ├─ MoMo ──► create intent → reserveStock → Paystack charge
               │              │              (release + fail if charge errors)
               │              ├─ POST /hooks/paystack ──► confirm or release
               │              └─ GET /store/checkout/status ──► verify + confirm
               └─ Card ──► create intent → reserveStock → Paystack initialize
                              │              (release + fail if init errors)
                              └─ callback / webhook / status poll → confirm
```

## Ownership

| Layer | Owns |
|-------|------|
| Pages | Rendering, client validation, feature flags |
| Workers | Authz, quotes, payment state machine, stock, OrderGroup |
| Postgres | System of record |
| Paystack | Charge/transfer truth for MoMo/card/payouts |

## Gaps (honest)

- Returns table unused; no Workers return API  
- Address book not persisted (shipping on intent only)  
- Wishlist / return UI still imports Medusa helpers — fail closed unless `VITE_ALLOW_MEDUSA_LAB=1` (quarantined; not Workers SoR)  
- Card and MoMo both `reserveStock` before Paystack while pending  
- Expiry handler ships; Workers Free may need admin-triggered `expire-payment-intents` until a cron slot or Paid plan is available  

