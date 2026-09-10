# Alkemart demo accounts (Workers / Supabase)

> **Security:** These passwords are for **lab/demo only**. Rotate before any public launch. Never reuse on production customer data.

API: `https://alkemart-api.glean-circular-passport.workers.dev`

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Admin** | `admin@alkemart.test` | `AdminPass1` | Seeded in Postgres; no public register |
| **Vendor** | `vendor@alkemart.test` | `VendorPass1` | Linked to catalog seller `seller-a` (Accra Mart / Tecno Spark). Re-login after migrate. |
| **Buyer** | `buyer@alkemart.test` | `BuyerPass1` | Storefront shopper |

## Canonical UIs (gold `#FEBF31`)

| App | Source | Live Pages |
|-----|--------|------------|
| Storefront | `apps/storefront` | https://alkemart4-storefront.pages.dev |
| Vendor | `apps/backend/apps/ghana-vendor` | https://alkemart4-vendor.pages.dev |
| Admin | `apps/backend/apps/admin` | https://alkemart4-admin.pages.dev |

All three bake `VITE_ALKEMART_API_URL=https://alkemart-api.glean-circular-passport.workers.dev`.

Production storefront builds **do not require** `VITE_MEDUSA_*`. Medusa is **quarantined**: `getMedusaClient()` throws unless `VITE_ALLOW_MEDUSA_LAB=1` and a Medusa backend URL are both set. Production Vite aliases `@medusajs/js-sdk` to `medusa-stub.ts`.

### Workers checkout note

COD / MoMo / card require `shippingAddress` on `POST /store/checkout`. Buyer order detail returns it. Schema column `payment_intents.shipping_address` (applied via `POST /admin/migrate/shipping-address`).

Do **not** use `archive/workers-shell-*-sludge` — those were mistaken generic shells.

## Account creation (Workers)

- **Buyer:** `POST /store/auth/register` `{ email, password }` or storefront Create account.
- **Vendor:** `POST /vendor/auth/register` `{ email, password, sellerName, sellerHandle }` (pending until admin approves).
- **Admin:** provisioned only. Login via `POST /admin/auth/login`.

Rotate these passwords before any public launch (and after enabling edge WAF — see `docs/ops/cloudflare-waf-checklist.md`):

```bash
# Admin JWT required. Supply only the passwords you want to change (min 10 chars).
curl -X POST "$API/admin/migrate/rotate-demo-passwords" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H 'content-type: application/json' \
  -d '{"adminPassword":"…","vendorPassword":"…","buyerPassword":"…"}'
```

Then update this file and any CI secrets. Do not commit real production passwords.

### Free-tier payment-intent expiry

When Workers cron slots are full, run the same job via admin:

```bash
curl -X POST "$API/admin/migrate/expire-payment-intents" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Schedule hourly until native `[triggers]` cron is active.
