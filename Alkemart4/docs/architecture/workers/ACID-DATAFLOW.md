# ACID dataflow — Workers

Doctrine: [`AGNOSTIC-APPROACH.md`](./AGNOSTIC-APPROACH.md). This file is the **data-plane** map (bindings, tables, transactions).

## Topology

| Binding / service | Role |
|-------------------|------|
| `HYPERDRIVE` | Catalog / category / seller reads (may cache) |
| `HYPERDRIVE_PRIMARY` | Auth, cart, checkout, stock, orders, payouts (read-after-write) |
| `CATALOG_KV` | Hot catalog cache + Paystack webhook event dedup |
| Paystack | MoMo charge, card initialize/verify, transfers, webhook HMAC |
| Pages UIs | UX only — no ledger |

**Rule:** Money and stock mutate only through Workers + primary Hyperdrive. No dual writers. Medusa is archived.

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
               │              │
               │              ├─ POST /hooks/paystack ──► confirm or release
               │              └─ GET /store/checkout/status ──► verify + confirm
               └─ Card ──► create intent → (must reserve) → Paystack initialize
                              │
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
- Wishlist Medusa-era paths  
- Card and MoMo both `reserveStock` while pending  
- No automatic expiry job for abandoned pending intents yet  
