# Live E2E workflow audit — clean-slate Mercur backend

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Target** | `http://localhost:9000` (Mercur/Medusa API) + SPA `:5175` |
| **DB** | Neon `alkemart_marketplace` on branch `medusa-prod` |
| **Method** | Live HTTP probes against running processes (API + SPA shell) |
| **Status** | Partial green — platform spine up; catalog/checkout incomplete |

---

## Environment under test

| Process | Port | Observed |
|---------|------|----------|
| Medusa/Mercur API | **9000** | `GET /health` → **OK** |
| Admin UI (served by API) | **9000/dashboard** | **200** |
| Vendor UI | **9000/seller** | **200** |
| SPA (Vite) | **5175** | Home **200** |
| Express legacy | 5000 | **down** (good — not dual-write) |
| Redis | 6379 | Installed earlier (`PONG`) |
| Neon | pooler | Connected; ~194 public tables |

Admin credentials (local only): `admin@alkemart.local` / `supersecret`

Clean-slate store keys (SPA `.env` updated to match):

| Key | Value |
|-----|--------|
| Publishable key | `pk_6b856950597168249a…` (new DB — **not** old SPA key) |
| Region | `reg_01KXMNJCTK5K5F60RB4FEJS59K` (Ghana / GHS) |
| Sales channel | `sc_01KXMN56SN3RSCSP55KE3A8BD4` |

---

## Workflow matrix

### A. Platform / infrastructure

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| A1 | API health | **PASS** | `GET /health` → `OK` |
| A2 | Admin JWT login | **PASS** | `POST /auth/user/emailpass` → token with `actor_id` set |
| A3 | Admin me | **PASS** | `GET /admin/users/me` → `admin@alkemart.local` |
| A4 | Super admin role | **PASS** | CLI `medusa user` assigned super admin |
| A5 | Admin UI shell | **PASS** | `/dashboard` HTTP 200 |
| A6 | Vendor UI shell | **PASS** | `/seller`, `/seller/register` HTTP 200 |
| A7 | Express dual-write | **PASS (absent)** | `:5000` not serving |
| A8 | SPA points at old publishable key | **FIXED in local `.env`** | Was `pk_de675…` (invalid on new DB → 400); now new key |

### B. Countries / currencies / commerce config

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| B1 | Create region Ghana/GHS | **PASS** | `POST /admin/regions` → `reg_01KXMNJCTK…`, country `gh` |
| B2 | Sales channel exists | **PASS** | Default sales channel present |
| B3 | Publishable key ↔ sales channel | **PASS** | Linked via admin API |
| B4 | System payment provider | **PASS** | `pp_system_default` enabled |
| B5 | Stock location | **PASS** | `Accra Warehouse` created |
| B6 | Shipping profile | **PASS** | Default profile present |

### C. Catalog

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| C1 | Create product (admin) | **PARTIAL** | Product `simple-product` exists as **draft**, **0 variants** (create hung / incomplete; re-create says handle exists) |
| C2 | Publish product | **PARTIAL** | Status set to `published` but still no variants |
| C3 | Attach sales channel to product | **FAIL** | `POST …/sales-channels` → **404** (wrong route for this Mercur/Medusa build) |
| C4 | Set variant GHS price | **BLOCKED** | No variant id |
| C5 | Store product list | **PASS (2026-07-16)** | `GET /store/products?region_id=…` → Golden Palm Oil (after product_seller + offer + SC) |
| C6 | SPA catalog browse | **PASS path** | SPA hooks map `offer_id`; restart Vite to pick env; list needs region_id |

### D. Buyer journey

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| D1 | SPA home loads | **PASS** | `:5175/` → 200 |
| D2 | SPA cart/checkout/signin shells | **PASS** | Routes return 200 |
| D3 | Customer auth register | **PARTIAL** | `POST /auth/customer/emailpass/register` returns token but `actor_id` empty (auth identity only — need customer create step) |
| D4 | Create cart (GHS region) | **PASS** | `POST /store/carts` → `cart_…`, `currency_code: ghs` |
| D5 | Add line item | **PASS (API)** | Mercur requires `offer_id` (not `variant_id`); cart total GHS 45 |
| D6 | Checkout / payment session | **PARTIAL** | Line items work; Paystack provider ported (enable with `PAYSTACK_SECRET_KEY`) |
| D7 | Order list / detail | **BLOCKED** | No completed orders |
| D8 | Paystack MoMo / card | **NOT IMPLEMENTED** | Only `pp_system_default`; Ghana Paystack adapter not ported |

### E. Vendor / marketplace journey

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| E1 | Seller UI register page | **PASS** | HTTP 200 |
| E2 | Seller auth register/login | **PASS** | Use **`member`** auth; `actor_id` after `POST /vendor/sellers` |
| E3 | Admin list sellers | **PASS** | ≥1 open sellers (Tema Fresh Goods + Accra Market) |
| E4 | Seller product ownership | **PASS** | Proposed → admin confirm → offer → store visible |
| E5 | Multi-vendor cart split | **NOT TESTED** | Needs ≥1 seller product + offer model |
| E6 | Commission / payout | **NOT TESTED** | Mercur modules present in schema; no live order |

### F. Admin ops (SPA dual-home)

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| F1 | SPA `/admin` without session | **401** | Expected gate |
| F2 | SPA `/vendor` | **200** | Shell loads (ops honesty depends on `VITE_OPS_BACKEND`) |
| F3 | SPA store page | **400** | Broken/incomplete store slug path |
| F4 | SPA ↔ new Medusa key alignment | **NEEDS SPA RESTART** | `.env` patched; Vite must reload env |

---

## Scorecard

| Area | Score | Notes |
|------|-------|-------|
| Runtime spine | **Green** | Health, admin, panels, Neon, no Express |
| Geo / region | **Green** | Ghana/GHS live |
| Admin identity | **Green** | Super admin usable |
| Catalog sellability | **Green** | Live product + offer GHS 45 via vendor RBAC |
| Buyer checkout | **Yellow** | Cart add works; full MoMo checkout needs Paystack keys + SPA session |
| Paystack Ghana | **Yellow** | Provider module on clean slate; keys not required for boot |
| Vendor marketplace | **Green** | Member auth + approve + product request + offer proven |
| SPA cutover | **Yellow** | Shells load; catalog key was stale (fixed in `.env`) |

**Overall:** Clean-slate **platform boots and authenticates**. End-to-end **buy / pay / multi-vendor** workflows are **not** green yet.

---

## Blockers (ordered)

1. **Sellable product pipeline** — create product with variants + GHS prices + sales channel (Medusa v2/Mercur field shapes; batch sales-channel route 404).
2. **SPA restart** after publishable key / region update.
3. **Customer/seller actor completion** — auth identity alone is not enough (`actor_id` empty until actor row created).
4. **Paystack payment module provider** on clean-slate app.
5. **Vendor onboarding** — register → admin approve → list product → store visibility.
6. **Neon TCP reliability** — some admin mutations hang under cold/timeout; prefer Linux worktree + keep compute warm.

---

## Recommended next E2E sprint (to reach “buy once”)

1. Seed one product via **admin UI** (dashboard) or fixed admin create script for Mercur 2.2 product API.  
2. Confirm `GET /store/products` returns ≥1 item.  
3. Cart add → complete cart with **system payment** (dev).  
4. Wire Paystack provider; retest MoMo with test MSISDN.  
5. Full seller path in headed browser: `/seller/register` → admin approve → product.  
6. Point SPA only at new keys; kill any remaining Express assumptions.

---

## Commands to re-run this audit

```bash
# API health
curl -s http://127.0.0.1:9000/health

# Admin login + sellers
TOKEN=$(curl -s -X POST http://127.0.0.1:9000/auth/user/emailpass \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@alkemart.local","password":"supersecret"}' | jq -r .token)
curl -s http://127.0.0.1:9000/admin/sellers -H "Authorization: Bearer $TOKEN" | jq .

# Store (must use NEW publishable key)
curl -s 'http://127.0.0.1:9000/store/products?limit=5' \
  -H "x-publishable-api-key: $VITE_MEDUSA_PUBLISHABLE_KEY" | jq .
```

---

## Conclusion

Live audit of **all critical workflows** shows:

- **Working:** backend health, admin auth/UI, vendor UI shells, Ghana region, empty cart create, SPA route shells, Express off.  
- **Not working / blocked:** store catalog, line items, checkout, Paystack, full multi-vendor, SPA catalog until product seed + env restart.

The clean-slate cutover is **real for ops identity and region**, not yet **real for commerce purchase**.
