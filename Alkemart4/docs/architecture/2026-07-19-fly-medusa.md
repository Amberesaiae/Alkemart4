# Deploy Medusa/Mercur on Fly.io (recommended cost path)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Why Fly** | Always-on VM, good price for 1–2 GB Node, Docker-native, no Railway upload/billing quirks |
| **App path** | `apps/backend` |
| **Public URL (default)** | `https://alkemart-api.fly.dev` |
| **Shop** | stays on Vercel |

## Cost (ballpark Hobby)

| Resource | Notes |
|----------|--------|
| **shared-cpu-1x, 2 GB RAM** | ~$10–15/mo always-on (region-dependent) |
| **Redis** | Upstash free tier **or** small Fly Redis (~$2–5) |
| **Neon** | Keep existing free/paid Neon (no second Postgres) |

vs Railway: similar for always-on; Fly often cheaper if you stay on one small Machine and avoid extras.

## Prerequisites

```bash
# CLI
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"

fly auth login
fly auth whoami
```

## First-time launch

```bash
cd apps/backend   # or /home/amber/alkemart-backend
# use repo fly.toml
fly launch --copy-config --no-deploy --name alkemart-api --region lhr
# answer: no Postgres (use Neon), no Redis yet if using Upstash
```

## Redis options

**A) Upstash (simplest, free tier)**  
Create Redis → copy `rediss://…` → `fly secrets set REDIS_URL=…`

**B) Fly Redis**  
```bash
fly redis create
# then
fly secrets set REDIS_URL='…'
```

## Secrets (required)

```bash
# From local packages/api/.env (do not commit)
fly secrets set \
  DATABASE_URL='postgresql://…neon…/alkemart_marketplace?sslmode=require' \
  REDIS_URL='redis://…' \
  JWT_SECRET='…≥32…' \
  COOKIE_SECRET='…≥32…' \
  PAYSTACK_SECRET_KEY='sk_test_…' \
  PAYSTACK_PUBLIC_KEY='pk_test_…' \
  MERCUR_BACKEND_URL='https://alkemart-api.fly.dev' \
  MERCUR_VENDOR_URL='https://alkemart-api.fly.dev/seller' \
  STORE_CORS='https://alkemart-storefront.vercel.app' \
  AUTH_CORS='https://alkemart-storefront.vercel.app,https://alkemart-api.fly.dev' \
  ADMIN_CORS='https://alkemart-api.fly.dev' \
  VENDOR_CORS='https://alkemart-api.fly.dev' \
  FILE_DRIVER='local' \
  FILE_BACKEND_URL='https://alkemart-api.fly.dev/static' \
  NODE_ENV='development'
```

`NODE_ENV=development` for first boot (local files OK). Flip to `production` only when `FILE_DRIVER=s3` + R2 keys are set (see `loadAppEnv`).

## Deploy

```bash
cd apps/backend
fly deploy --build-arg MERCUR_BACKEND_URL=https://alkemart-api.fly.dev
fly status
fly logs
curl -sS https://alkemart-api.fly.dev/health
```

Surfaces:

| URL | Surface |
|-----|---------|
| `https://alkemart-api.fly.dev/health` | API health |
| `https://alkemart-api.fly.dev/dashboard` | Admin |
| `https://alkemart-api.fly.dev/seller` | Seller Hub |

## Wire Vercel shop

```bash
printf '%s' 'https://alkemart-api.fly.dev' | vercel env add VITE_MEDUSA_BACKEND_URL production
# then redeploy storefront
vercel deploy --prod --yes
```

## Scale / cost knobs

```bash
# More RAM if Medusa OOMs
fly scale memory 2048
# or 4096 if needed

# Stop machines when idle (NOT recommended for public shop API)
# set auto_stop_machines = 'stop' in fly.toml — causes cold starts
```

## vs Railway (decision)

| | Fly | Railway |
|--|-----|---------|
| Cost (1 always-on API) | Often lower | Higher with plugins |
| DX | CLI + Docker | Dashboard + Git |
| Redis | Upstash or plugin | One-click plugin |
| Fit Medusa | Excellent | Excellent |
| **Alkemart pick** | **Yes (default)** | OK if already paid |

Railway project can stay unused; no need to delete immediately.
