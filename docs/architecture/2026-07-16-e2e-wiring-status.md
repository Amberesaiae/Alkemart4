# End-to-end wiring status — Alkemart clean slate

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Product mode** | **Mode B lab freeze** — [`2026-07-16-mode-b-lab-demo-freeze.md`](./2026-07-16-mode-b-lab-demo-freeze.md) |
| **Canonical gap map** | [`2026-07-16-e2e-architecture-gap-map.md`](./2026-07-16-e2e-architecture-gap-map.md) (technical debt; not “done”) |
| **Story** | Lab COD buy path only; MoMo opt-in lab; not production |

---

## Executive summary

| Scope | Score | Reality |
|-------|-------|---------|
| Demo COD buy-once (API) | **~70%** | Product → offer cart → ship map → `ghana-checkout` COD → order id **live** |
| Production Ghana marketplace | **~30–35%** | MoMo, webhooks, cancel/refund, dense catalog, order UI, support, store slug **not done** |
| SPA unclog (dual-home) | **Routes done** | Admin/vendor deleted; Express stubs still on support/password/cancel |

---

## Quick boundary table

| Boundary | Status | One-line |
|----------|--------|----------|
| SPA shell `:5175` | OK | Buyer routes only |
| CORS / PK / region / SC | OK | `.env` aligned |
| Store products | OK thin | **1** product + offer GHS 45 |
| Categories | **FAIL** | count **0** |
| Offer cart add | OK | Mercur `offer_id` |
| Seller-keyed shipping | OK | flatten + attach live |
| `ghana-checkout` COD | OK | order `order_01KXNZ25…` |
| `ghana-checkout` MoMo | **CODE READY** | 503 without keys; with keys: charge → pending/success → webhook/poll complete |
| `GET …/ghana-checkout/status` | **OK** | SPA poll while USSD pending |
| `POST /hooks/paystack` | **OK** | HMAC + verify + complete cart |
| Payment providers | Partial | `pp_system_default` for complete; MoMo is charge-first external |
| `GET /store/alkemart/me` | **404** | SPA falls back to customer |
| `GET /store/alkemart/vendors/:slug` | **404** | Store page broken |
| Order detail UI | **Mismatch** | Express-shaped fields vs Medusa mapper |
| Cancel / dispute / support / password | **Express stubs** | Express down |
| Mercur admin/seller panels | OK | `:9000` + `:7000`/`:7001` |
| Express `:5000` | Off | Good |
| Dual worktree | Risk | Live API on `/home/amber/…` vs `apps/backend` |

---

## Do not trust older audits blindly

`2026-07-16-live-e2e-workflow-audit.md` still claims empty catalog / blocked orders in places — **superseded** by later COD success and this gap map.

---

## Credentials (local only)

| Role | Identity |
|------|----------|
| Admin | `admin@alkemart.local` / `supersecret` |
| Seller member | `member.tema@alkemart.local` / `VendorPass123!` |
| Buyer | emailpass register → `POST /store/customers` → login |

---

## Next (P0 from gap map)

1. Fix or remove `/store/alkemart/me` + vendor slug.  
2. Order detail Medusa field mapping.  
3. Customer-linked carts for order history.  
4. Paystack keys + MoMo path + webhook.  
5. Categories + catalog density.  
6. Kill Express stub callers.
