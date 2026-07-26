# Production Go-Live: Status & Remaining Actions

## What's Been Fixed

| Fix | Status | Session |
|-----|--------|---------|
| CORS: removed localhost origins | ✅ Done | This session |
| Meilisearch: deployed to Railway | ✅ Done | This session |
| Meilisearch: wired to alkemart-api | ✅ Done | This session |
| CI: integration tests added | ✅ Done | This session |
| CI: deploy workflow created | ✅ Done | This session |
| Dev: bun install TMPDIR fix | ✅ Done | This session |
| Dev: .env files created | ✅ Done | This session |
| Dev: Vercel deploy script | ✅ Done | This session |
| Dev: S3 storage setup script | ✅ Done | This session |
| Dev: Sentry setup script | ✅ Done | This session |
| Dev: Admin build hang diagnosed | ✅ Done | This session |
| P1.3 marketplace indexes | ✅ Done | Previous |
| [object Object] metadata corruption | ✅ Done | Previous |
| Lab orders/carts/auth purged | ✅ Done | Previous |
| Paystack linked to Ghana region | ✅ Done | Previous |

## Remaining: Needs Your Action

### 1. S3 File Storage (CRITICAL)

The backend will crash on restart without S3. Run:

```bash
# Option A: Cloudflare R2 (recommended - free tier: 10GB + 1M ops/month)
# 1. Sign up at dash.cloudflare.com → R2 → Create bucket "alkemart-media"
# 2. Create R2 API token with read/write permissions
# 3. Run:
bash scripts/setup-s3-storage.sh \
  https://<account-id>.r2.cloudflarestorage.com \
  <access-key> <secret-key> alkemart-media auto

# Option B: Backblaze B2 ($0.006/GB storage, $0.01/GB download)
# 1. Sign up at b2.backblazeb2.com → Create bucket "alkemart-media"
# 2. Create App Key with read/write permissions
# 3. Run:
bash scripts/setup-s3-storage.sh \
  https://s3.us-west-004.backblazeb2.com \
  <keyID> <applicationKey> alkemart-media us-west-004
```

### 2. Paystack Live Keys

Current Railway env has test keys (`sk_test_...`, `pk_test_...`).
Replace in Railway dashboard → alkemart-api → Variables:
- `PAYSTACK_SECRET_KEY` → live secret key from dashboard.paystack.com
- `PAYSTACK_PUBLIC_KEY` → live public key from dashboard.paystack.com

### 3. Deploy Storefront to Vercel

```bash
cd apps/storefront
npm install -g vercel && vercel login
bash scripts/deploy-storefront.sh
```

### 4. Sentry Monitoring (optional but recommended)

```bash
# 1. Create project at sentry.io → JavaScript
# 2. Copy DSN
bash scripts/setup-sentry.sh https://...@sentry.io/...
# 3. Add VITE_SENTRY_DSN to Vercel env vars
```

### 5. Railway Token for CI/CD Deploys

```bash
# 1. Get token: Railway dashboard → Account Settings → Tokens → Create
# 2. Add to GitHub: repo Settings → Secrets → Actions → New
#    Name: RAILWAY_TOKEN
#    Value: <your-token>
```

### 6. Bun Install Fix (local dev only)

```bash
# Add to ~/.bashrc or ~/.zshrc:
source /home/amber/Desktop/amber/Alkemart4/Alkemart4/scripts/fix-bun-tmpdir.sh
```

## Architecture Summary

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Vercel      │────▶│  Railway     │────▶│  Neon    │
│  Storefront  │     │  alkemart-api│     │  Postgres│
│  (React)     │     │  (Medusa)    │     │          │
└─────────────┘     └──────┬───────┘     └──────────┘
                           │
                    ┌──────┼───────┐
                    │      │       │
               ┌────┴─┐ ┌─┴──┐ ┌──┴────────┐
               │Redis │ │Meili│ │S3 (R2/B2) │
               │      │ │search│ │(Tigris)   │
               └──────┘ └────┘ └───────────┘
```
