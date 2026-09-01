# Supabase (now) + Hyperdrive setup

**Project:** `alkemart`  
**Ref:** `iyjkvqfyjffkafnokfvt`  
**Region:** West EU (Ireland) `eu-west-1`  
**Dashboard:** https://supabase.com/dashboard/project/iyjkvqfyjffkafnokfvt  

Local secrets (gitignored): `Alkemart4/.local/supabase-alkemart.env`

Schema migrations `0000`–`0004` have been applied to this project.

---

## 1. Local env

```bash
cd Alkemart4
set -a && source .local/supabase-alkemart.env && set +a
# DATABASE_URL          → direct (drizzle / admin)
# DATABASE_URL_POOLER   → pooler :6543 (Hyperdrive origin)
```

---

## 2. Create dual Hyperdrive configs

Requires Cloudflare account login (`wrangler login`).

```bash
# Cached catalog reads
npx wrangler hyperdrive create alkemart-catalog \
  --connection-string="$DATABASE_URL_POOLER"

# Primary writes (auth, checkout, stock, payouts)
npx wrangler hyperdrive create alkemart-primary \
  --connection-string="$DATABASE_URL_POOLER"
```

IDs already created and written to `apps/api/wrangler.toml`:

| Binding | Hyperdrive name | ID |
|---|---|---|
| `HYPERDRIVE` | `alkemart-catalog` | `6e4c334582d5499c87bbf10fee564b75` |
| `HYPERDRIVE_PRIMARY` | `alkemart-primary` | `a77fbb34c2374d1d9d6be0e65c92c177` |

Origin used: Supabase **direct** host `db.<ref>.supabase.co` (pooler username form failed during create; can switch later).

Also create/bind `CATALOG_KV` and set secrets:

```bash
npx wrangler secret put JWT_SECRET      # ≥32 chars
npx wrangler secret put PAYSTACK_SECRET_KEY
```

---

## 3. Frontends (same Cloudflare side)

| App | Host | API |
|---|---|---|
| store | Pages | `VITE_ALKEMART_API_URL` → Workers |
| vendor | Pages | same |
| admin | Pages | same |

Three apps, one Workers API.

---

## 4. Later (Railway)

Re-point both Hyperdrive origins to Railway Postgres. Add Meilisearch + Redis on Railway. App code unchanged.

---

## 5. Speed notes

- Catalog/list → `HYPERDRIVE` (+ KV)  
- Checkout/auth/payout → `HYPERDRIVE_PRIMARY`  
- Keep Supabase awake on free tier (periodic ping) or upgrade when live  
