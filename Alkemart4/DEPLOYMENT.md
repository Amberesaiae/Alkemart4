# Alkemart — Production Deployment Guide

> Stack: **Medusa v2 + Mercur** backend · **Neon** PostgreSQL · **Railway** (API + Redis + Meilisearch) · **Vercel** (storefront) · **S3-compatible** object storage (Tigris/Backblaze B2)

---

## Architecture

```
Browser / Mobile PWA
        │
        ▼
  Vercel (CDN)                ← storefront SPA (Vite + React)
        │
        ▼
  Railway API Service          ← Medusa v2 + Mercur (Node 22 / Bun)
        │         │
        ▼         ▼
   Neon DB     Railway Redis   ← PostgreSQL (pooled) + cache/sessions
        │
        ▼
 Railway Meilisearch           ← full-text search + click tracking
        │
        ▼
   S3 Storage (Tigris/B2)      ← product images + derivatives
        │
        ▼
   Paystack                    ← Ghana card + MoMo payments
        │
        ▼
Africa's Talking               ← SMS + WhatsApp order notifications
```

---

## 1. Neon PostgreSQL

**Best practices:**
- Use the **pooled** connection string at runtime (PgBouncer transaction mode, safe for Medusa)
- Use the **unpooled** string only for migrations (`medusa db:migrate`) and one-off scripts
- Enable the `pg_trgm` extension for fuzzy search if needed
- Neon auto-suspends on the free tier; paid plan recommended for production (no cold start)

**Setup:**
```bash
# From Neon dashboard → alkemart_marketplace project → medusa-prod branch
# Copy both connection strings into Railway Variables:
DATABASE_URL=postgresql://user:pass@ep-XXXXX-pooler.region.aws.neon.tech/alkemart?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-XXXXX.region.aws.neon.tech/alkemart?sslmode=require
```

**Run migrations:**
```bash
# From apps/backend/packages/api — use UNPOOLED for migrations
DATABASE_URL=$DATABASE_URL_UNPOOLED bun medusa db:migrate
```

**Staging strategy:**
- Use Neon branching: `neon branches create --name staging` → separate `DATABASE_URL` for the staging Railway service
- Branch from production for integration tests; delete after merging

---

## 2. Railway — API Service

**railway.toml** is committed; secrets go in Railway dashboard Variables only.

**Required Variables (set in Railway → Variables tab):**

| Variable | Source |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL (migrations only) |
| `REDIS_URL` | Railway Redis service URL |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `COOKIE_SECRET` | `openssl rand -base64 48` |
| `STORE_CORS` | `https://alkemart.vercel.app,https://alkemart.com` |
| `VENDOR_CORS` | `https://alkemart-api-production.up.railway.app/seller` |
| `ADMIN_CORS` | `https://alkemart-api-production.up.railway.app/dashboard` |
| `AUTH_CORS` | comma-joined list of all origins above |
| `FILE_DRIVER` | `s3` |
| `S3_FILE_URL` | public base URL of your bucket (e.g. `https://alkemart.fly.storage.tigris.dev`) |
| `S3_ENDPOINT` | bucket endpoint (Tigris: `https://fly.storage.tigris.dev`) |
| `S3_BUCKET` | `alkemart-media` |
| `S3_ACCESS_KEY_ID` | from storage provider |
| `S3_SECRET_ACCESS_KEY` | from storage provider |
| `S3_REGION` | `auto` for Tigris/R2; region string for B2/AWS |
| `PAYSTACK_SECRET_KEY` | Paystack live secret key |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signing secret |
| `RESEND_API_KEY` | Resend API key (email) |
| `EMAIL_FROM` | `Alkemart <noreply@alkemart.com>` |
| `AT_API_KEY` | Africa's Talking API key |
| `AT_USERNAME` | Africa's Talking username |
| `AT_SENDER_ID` | `ALKEMART` (after AT registration) |
| `WA_PHONE_NUMBER_ID` | Meta Cloud API phone number ID |
| `WA_ACCESS_TOKEN` | Meta system user permanent token |
| `MEILISEARCH_HOST` | Railway Meilisearch internal URL |
| `MEILISEARCH_API_KEY` | Meilisearch master key |
| `STOREFRONT_URL` | `https://alkemart.com` |

**Deploy:**
```bash
# Railway CLI
railway login
railway link <project-id>
railway up --service api
```

**Health check:** `GET /health` — Railway checks every 30s, restarts on 5 consecutive failures.

---

## 3. Railway — Redis

**Add Redis service:**
1. Railway dashboard → New Service → Database → Redis
2. Copy `REDIS_URL` from Redis service Variables tab → paste into API service Variables

**Best practices:**
- Use `rediss://` (TLS) URL — Railway provides TLS by default
- Set `maxmemory-policy allkeys-lru` in Redis config for cache eviction
- Redis is used for: Medusa event bus, session store, catalog cache (`CATALOG_CACHE_TTL_SEC`)
- Free tier: 512MB — sufficient for up to ~50 concurrent sellers

---

## 4. Railway — Meilisearch

**Add Meilisearch service:**
1. Railway dashboard → New Service → search "Meilisearch" → deploy official template
2. Set `MEILI_MASTER_KEY` to a strong random string: `openssl rand -base64 32`
3. Copy the internal Railway URL → set as `MEILISEARCH_HOST` in the API service

**Best practices:**
- Use Railway's internal networking (private hostname, not public URL) for API → Meilisearch traffic
- Enable Meilisearch analytics in production to track search queries and gaps
- Reindex after deploy: `POST /admin/search/reindex` (authenticated)
- Tune typo tolerance for Ghanaian names: enable 1-typo for words ≥ 4 chars (Meilisearch default)

**Initial index:**
```bash
# From apps/backend/packages/api, after migrations
bun medusa exec ./src/scripts/reindex-search.ts
```

---

## 5. Object Storage — Tigris (recommended) or Backblaze B2

### Option A: Tigris (Railway-native, free tier, global PoPs)
1. Railway dashboard → New Service → Tigris
2. Tigris auto-injects `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BUCKET_NAME`, `AWS_ENDPOINT_URL_S3`
3. Map to Medusa vars in API service:
   ```
   S3_ACCESS_KEY_ID    = $AWS_ACCESS_KEY_ID
   S3_SECRET_ACCESS_KEY = $AWS_SECRET_ACCESS_KEY
   S3_ENDPOINT         = $AWS_ENDPOINT_URL_S3
   S3_BUCKET           = $BUCKET_NAME
   S3_REGION           = auto
   S3_FILE_URL         = https://<bucket>.fly.storage.tigris.dev
   ```
4. Set bucket policy to **public read** in Tigris dashboard so product images load without auth

### Option B: Backblaze B2 ($0.006/GB storage, $0.01/GB download — cheapest)
1. backblazeb2.com → Create Bucket (public) → App Keys → Create Key (read/write)
2. Enable "S3-Compatible API" — B2 is fully S3-compatible
3. Set:
   ```
   S3_ENDPOINT     = https://s3.<region>.backblazeb2.com
   S3_REGION       = <region>  # e.g. us-west-004
   S3_BUCKET       = alkemart-media
   S3_FILE_URL     = https://f<N>.backblazeb2.com/file/alkemart-media
   ```

**Image derivatives:** Sharp runs in the `process-product-images` cron (every 5 min). It generates:
- `thumb`: 400px WebP — used in product cards
- `web`: 1600px WebP — used on PDP

---

## 6. Vercel — Storefront

**Setup:**
```bash
cd Alkemart4/apps/storefront
vercel --prod
```

**Required Environment Variables (Vercel dashboard → Settings → Environment Variables):**

| Variable | Value |
|---|---|
| `VITE_MEDUSA_BACKEND_URL` | `https://alkemart-api-production.up.railway.app` |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | Medusa publishable API key (from Admin → API Keys) |
| `VITE_PUBLIC_SITE_URL` | `https://alkemart.com` |
| `VITE_POSTHOG_KEY` | PostHog project API key |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` |

**CSP:** `vercel.json` has a strict Content-Security-Policy. Update `connect-src` if you add new API domains.

**PWA:** `vite-plugin-pwa` generates the service worker at build time. Vercel serves the SW at `/sw.js` with `Cache-Control: no-cache` automatically (Vercel respects `workbox` SW headers).

**Storefront SEO builds:**
```bash
# Prerender product detail pages for Google (baked HTML with meta tags)
bun run build:seo
```
This runs `scripts/prerender-pdp.mjs` after the main build — produces static HTML shells for PDPs that crawlers can read without executing JavaScript.

**Custom domain:**
1. Vercel → Settings → Domains → add `alkemart.com` and `www.alkemart.com`
2. Update `STORE_CORS` on Railway to include both domains
3. Update `VITE_PUBLIC_SITE_URL` on Vercel

---

## 7. Notifications Setup

### Email (Resend)
1. resend.com → create account → API Keys → create key
2. Add your domain (alkemart.com) → follow DNS verification
3. Set `RESEND_API_KEY` and `EMAIL_FROM` in Railway

### SMS (Africa's Talking)
1. africastalking.com → sign up → create application
2. Settings → API Key → copy
3. SMS → Sender IDs → request `ALKEMART` (takes 1–3 business days for Ghana approval)
4. Set `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID` in Railway
5. Test: set `AT_SANDBOX=true` + use AT sandbox numbers for integration tests

### WhatsApp (Meta Cloud API)
1. developers.facebook.com → create app → add WhatsApp product
2. business.facebook.com → WhatsApp → Getting Started → get phone number ID + token
3. Create System User → generate permanent token (never expires)
4. Create message templates (business.facebook.com → WhatsApp → Message Templates):
   - `alkemart_order_confirmed` — body: `Hi {{1}}, your order {{2}} for {{3}} is confirmed.`
   - `alkemart_order_shipped` — body: `Your order {{1}} is on its way! Rider will call you shortly.`
   - `alkemart_new_order_vendor` — body: `{{1}}, new order {{2}} ({{3}} items). Log in to pack & ship.`
   - `alkemart_seller_approved` — body: `Your Alkemart shop "{{1}}" is approved! Start listing now.`
5. Wait for Meta template approval (~24h)
6. Set `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN` in Railway

---

## 8. Production Checklist

### One-time setup
- [ ] Neon project created, `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` copied
- [ ] `bun medusa db:migrate` run with unpooled URL
- [ ] Category seed: `bun medusa exec ./src/scripts/ensure-ghana-categories.ts`
- [ ] Paystack live keys set, webhook URL configured: `https://alkemart-api-production.up.railway.app/api/hooks/paystack`
- [ ] Storage bucket created + public read policy set
- [ ] Meilisearch indexed: `POST /admin/search/reindex`
- [ ] Resend domain verified + `RESEND_API_KEY` set
- [ ] Africa's Talking sender ID `ALKEMART` approved + `AT_API_KEY` set
- [ ] Meta WhatsApp templates approved + `WA_PHONE_NUMBER_ID` set
- [ ] Medusa Admin publishable key created → set as `VITE_MEDUSA_PUBLISHABLE_KEY` on Vercel
- [ ] Custom domain set on Vercel → CORS updated on Railway

### Every deploy
- [ ] `railway up` from `apps/backend` — zero-downtime rolling restart
- [ ] `vercel --prod` from `apps/storefront` — atomic Vercel deployment
- [ ] Run `bun run build:seo` as part of Vercel build command for prerendered PDPs

### Health checks
- API: `GET https://alkemart-api-production.up.railway.app/health`
- Search: `GET https://<meilisearch-url>/health`
- Storefront: Vercel deployment status

---

## 9. Scaling Notes

| Component | Free tier capacity | First upgrade |
|---|---|---|
| Neon | 0.5 GB storage, auto-suspend | Neon Launch ($19/mo) — no suspend, 10 GB |
| Railway API | 8 GB RAM shared, sleeps | Hobby ($5/mo) — always-on |
| Railway Redis | 512 MB | Scale up plan or Upstash Redis |
| Meilisearch | 100K documents | Meilisearch Cloud Growth plan |
| Vercel | 100 GB bandwidth | Vercel Pro ($20/mo) |
| Africa's Talking | Pay-per-SMS (GHS ~0.04/SMS) | No tiers — volume discounts available |

---

## Legacy / Archived

- `fly.toml` — archived fallback (Fly.io `jnb` region). Updated to `NODE_ENV=production` + `FILE_DRIVER=s3` in case it's ever used. Railway is the primary deployment target.
- `Alkemart4/archive/` — old Express API + lab SPA. Do not deploy.
