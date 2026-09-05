# Deploy Medusa/Mercur on Railway

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **CLI** | `railway` 5.x (logged in) |
| **App path** | `apps/backend` (Dockerfile + railway.toml) |
| **Service** | long-running Node — API :9000, Admin `/dashboard`, Seller `/seller` |
| **Shop** | stays on Vercel |

## One-time setup

```bash
cd apps/backend   # or /home/amber/alkemart-backend

railway login          # done if `railway whoami` works
railway link           # pick project (e.g. comfortable-success) + service alkemart-api
# or: railway link --project comfortable-success

# Redis (required)
railway add --database redis --json

# Public HTTPS URL (port 9000)
railway domain --port 9000
# note the URL → https://….up.railway.app
```

## Variables (API service)

Copy values carefully (no localhost in **production** CORS).

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | First boot: `development` **or** full `production` (needs S3+Paystack) |
| `DATABASE_URL` | Neon **pooled** URL for `alkemart_marketplace` |
| `REDIS_URL` | From Railway Redis plugin `${{Redis.REDIS_URL}}` if linked |
| `JWT_SECRET` | ≥32 chars in production |
| `COOKIE_SECRET` | ≥32 chars in production |
| `STORE_CORS` | `https://alkemart-storefront.vercel.app` |
| `AUTH_CORS` | same shop + admin/seller public origins |
| `ADMIN_CORS` | `https://YOUR-RAILWAY-DOMAIN` (same host OK) |
| `VENDOR_CORS` | same |
| `MERCUR_VENDOR_URL` | `https://YOUR-RAILWAY-DOMAIN/seller` |
| `PAYSTACK_SECRET_KEY` | required if `NODE_ENV=production` |
| `FILE_DRIVER` | `s3` required in production; `local` only for non-prod |
| `S3_*` | R2/S3 when production |
| `PORT` | `9000` |

Reference interpolation (Redis service named `Redis`):

```bash
railway variable set REDIS_URL='${{Redis.REDIS_URL}}' --service alkemart-api --skip-deploys
```

## Build arg (panels)

Admin/Seller bake API origin at **Docker build** time:

```bash
railway variable set MERCUR_BACKEND_URL=https://YOUR-RAILWAY-DOMAIN --skip-deploys
# Railway Docker ARG: pass via railway.toml or service settings as Docker build arg
```

If panels still point at localhost after first deploy, set `MERCUR_BACKEND_URL` and **redeploy** so the image rebuilds.

## Deploy

```bash
cd apps/backend
railway up --detach
railway logs
railway domain list
```

Smoke:

```bash
curl -sS https://YOUR-RAILWAY-DOMAIN/health
# Admin:  https://YOUR-RAILWAY-DOMAIN/dashboard
# Seller: https://YOUR-RAILWAY-DOMAIN/seller
```

## Wire Vercel shop

```bash
# Production env on alkemart-storefront
printf '%s' 'https://YOUR-RAILWAY-DOMAIN' | vercel env add VITE_MEDUSA_BACKEND_URL production
# then
vercel deploy --prod --yes
```

## Production gate notes

`loadAppEnv()` **refuses** `NODE_ENV=production` without:

- Paystack secret
- `FILE_DRIVER=s3` + bucket/keys/public URL
- HTTPS-only CORS (no localhost)

**First Railway smoke:** set `NODE_ENV=development` with Neon + Redis + CORS including Vercel origin, get `/health` green, then add R2 + flip to production.

## Do not

- Put Neon Marketplace DB install on Railway (use existing Neon)
- Deploy Express root Dockerfile (deprecated)
- Host full Mercur API on Vercel serverless
