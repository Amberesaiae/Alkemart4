# Alkemart demo accounts (Workers / Supabase)

> **Security incident:** Previously published demo passwords must be treated as compromised, including copies in git history. Removing them here does not rotate live accounts. Rotate through a trusted operator, revoke sessions, and keep replacement credentials in a password manager or CI secret store, never this repository.

API: `https://alkemart-api.glean-circular-passport.workers.dev`

| Role | Email | Notes |
|------|-------|-------|
| **Admin** | `admin@alkemart.test` | Provisioned only; rotate and require MFA |
| **Vendor** | `vendor@alkemart.test` | Verify seller membership before any stock change |
| **Buyer** | `buyer@alkemart.test` | Demo shopper; rotate |

## Canonical UIs (gold `#FEBF31`)

| App | Source | Live Pages |
|-----|--------|------------|
| Storefront | `apps/storefront-v2` | https://alkemart4-storefront.pages.dev |
| Vendor | `apps/vendor-v2` | https://alkemart4-vendor.pages.dev |
| Admin | `apps/admin-v2` | https://alkemart4-admin.pages.dev |

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
# Admin JWT required. Supply only the passwords you want to change (14–200 chars).
curl -X POST "$API/admin/migrate/rotate-demo-passwords" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H 'content-type: application/json' \
  -d '{"adminPassword":"…","vendorPassword":"…","buyerPassword":"…"}'
```

Update CI secrets privately. Do not put replacement passwords in this file or shell history. The hardened rotation endpoint stamps password changes so old sessions are rejected; deploy that fix before relying on revocation. Do not sign in with exposed demo credentials to verify them.

### Free-tier payment-intent expiry

When Workers cron slots are full, run the same job via admin:

```bash
curl -X POST "$API/admin/migrate/expire-payment-intents" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Schedule hourly until native `[triggers]` cron is active.
