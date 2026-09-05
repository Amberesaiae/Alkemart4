# Operating markets — country as canonical gate

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Status** | Accepted (foundational) |
| **Supersedes** | Hard-coded “seed = Ghana product model” thinking |
| **Builds on** | Clean-slate ADR region-first note; commercial spine GHS rules |

## Problem

Treating **seed scripts** as how the product “is Ghana” does not scale:

- Seeds are **bootstrap** (empty DB → first region).
- Runtime forms (onboarding, address, currency) must not depend on re-running seed.
- Multi-country later must not force a rewrite of every form.

## Decision

**Admin-gated Medusa Regions are the operating-market SoR.**

```text
Admin enables country on a Region (currency + countries)
        │
        ▼
GET /store/alkemart/markets  (and /admin/alkemart/markets)
        │
        ▼
UI: user picks country_code
        │
        ├── currency_code     (from region)
        ├── address field set (from country locale profile)
        ├── phone rules
        └── payment/shipping hints
```

| Layer | Role | ACID / consistency |
|-------|------|---------------------|
| **Region + countries** (Postgres) | What is *in operation* | Transactional; admin writes; cart/order use `region_id` |
| **Country locale profile** (code config) | How that country *behaves* in forms | Deterministic; versioned in git; no parallel money tables |
| **Seed / ensure-*** scripts | Optional first-time bootstrap only | Not the product model; safe to re-run or skip if region exists |

## What admin controls (no massive future refactor)

1. **Turn on a market:** Settings → Regions → currency + attach country ISO.
2. **Turn off a market:** Remove country from region (or delete/archive region).
3. **Money:** Region currency is the only currency that market sells in (cart inherits region).
4. **Forms:** Already country-driven; new country = add a profile entry + enable in Admin.

## What we refuse

- A second “operating_countries” table that can disagree with regions.
- Forms hard-coding `GH` / `GHS` with no path for `NG` / `KE` later.
- Seed as the only place Ghana exists.

## API

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /store/alkemart/markets` | Publishable key / store | Buyer + public forms |
| `GET /admin/alkemart/markets` | Admin session | Ops visibility + guidance |

Response shape (conceptual):

```json
{
  "markets": [
    {
      "region_id": "reg_…",
      "region_name": "Ghana",
      "currency_code": "ghs",
      "country_code": "gh",
      "display_name": "Ghana",
      "locale": { "phone": {}, "address": { "fields": [] }, "payments": {} }
    }
  ],
  "default_country_code": "gh",
  "default_region_id": "reg_…",
  "default_currency_code": "ghs"
}
```

## Ghana today

Ghana is the **first operating profile** (`COUNTRY_PROFILES.gh`).  
Enabling GH on a GHS region is how production “is Ghana” — not because seed said so.

## Seed’s real job

Only: empty lab DB → one region so developers can log in.  
Production ops: Admin regions. Scripts like `ensure-ghana-region` are **optional repair**, not architecture.

## Tissue map (where this is baked in)

| Surface | Binding |
|---------|---------|
| `GET /store/alkemart/markets` | Buyer SPA — country list + locale |
| `GET /admin/alkemart/markets` | Admin **Markets** page + ops |
| `GET /vendor/alkemart/markets` | Seller onboarding tip (currency per country) |
| Storefront checkout / account | `MarketAddressFields` from market locale |
| Storefront `region.ts` | Countries = operating markets only |
| `normalizePhoneForCountry` | MoMo charge uses shipping address country |
| Cart / order | Medusa `region_id` + currency (existing SoR) |

**Enabling a new country later:** Admin region + optional profile in `COUNTRY_PROFILES` — forms already consume markets API.

## Server enforcement (must not skip)

`runGhanaCheckout` → `requireCartReadyForCheckout`:

1. Shipping `country_code` must appear in `listOperatingMarkets`.
2. Cart `currency_code` must equal that market's region currency.
3. Required locale address fields must be non-empty on the cart.

UI alone is not enough; money path rejects non-operating countries.

## Vendor markets without seller context

`GET /vendor/alkemart/markets` exports `AUTHENTICATE = false` so Mercur
`ensureSeller` does not require `x-seller-id`. Data is non-secret market config
(same as store markets). Seller onboarding can load it before store select.
