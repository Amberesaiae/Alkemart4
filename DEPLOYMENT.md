# Alkemart Deployment Plan

> **2026-07-18:** Express dual-home is **archived**. Production = Mercur/Medusa API + greenfield storefront + Seller Hub + Admin.  
> Onboarding/quality ADR: `docs/architecture/2026-07-18-seller-onboarding-product-quality-pipeline.md`  
> Clean slate: `docs/architecture/2026-07-16-clean-slate-backend.md`

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  Buyer SPA          │     │  apps/backend            │     │  Neon PG     │
│  apps/storefront    │────▶│  Mercur + Medusa         │────▶│  alkemart_   │
│  static / Pages     │     │  API :9000               │     │  marketplace │
└─────────────────────┘     │  /seller  /dashboard     │     └──────────────┘
                            │  Redis workers (jobs)    │
                            │  Meilisearch (optional)  │
                            │  R2/S3 media (prod)      │
                            │  Paystack (prod)         │
                            └──────────────────────────┘
```

| Surface | Path | Notes |
|---------|------|--------|
| Buyers | `apps/storefront` | Vite static → Cloudflare Pages / similar |
| Sellers | Mercur Vendor | `/seller` — register, readiness, catalog |
| Admins | Mercur Admin | `/dashboard` — Seller queue, Product review |
| API | `apps/backend/packages/api` | Sole commerce write path |

## Production env checklist (API)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | yes | Neon pooled `alkemart_marketplace` |
| `REDIS_URL` | yes | Workers / events / jobs |
| `JWT_SECRET` / `COOKIE_SECRET` | yes ≥32 | No `supersecret` |
| `STORE_CORS` / `ADMIN_CORS` / `VENDOR_CORS` / `AUTH_CORS` | yes | Real **https** origins only — no `*`, no localhost |
| `PAYSTACK_SECRET_KEY` | **yes in prod** | Boot fails without it |
| `FILE_DRIVER` | **`s3` in prod** | Boot fails on `local` |
| `S3_FILE_URL`, `S3_BUCKET`, keys | yes if s3 | R2: `acl: false`, path-style |
| `MEILISEARCH_HOST` | recommended | Discovery sellable-only |
| `EMAIL_FROM` + Resend/SMTP | recommended | Seller/product lifecycle mail |
| `ALKEMART_STRICT_PROPOSE_GATES` | default true | Setup + quality before propose |

Template: `apps/backend/packages/api/.env.template`

## Production env checklist (storefront)

| Variable | Required |
|----------|----------|
| `VITE_MEDUSA_BACKEND_URL` | API origin (**https**, not localhost in prod builds) |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | From Admin |
| `VITE_MEDUSA_REGION_ID` | Ghana region |
| `VITE_MEDUSA_SALES_CHANNEL_ID` | Store channel |
| `VITE_MERCUR_VENDOR_URL` / `VITE_MERCUR_ADMIN_URL` | Deep links |
| `VITE_FILTER_STORE_SELLABLE` | default `true` — client prefers `offer_id` rows; **strict empty** in prod builds if none |
| `VITE_USE_ALKEMART_CATALOG` | default `true` — home/browse uses `/store/alkemart/catalog` |
| `VITE_PUBLIC_SITE_URL` | recommended — canonical/OG origin (https) |

## Workers / jobs (need Redis + running process)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `alkemart-process-product-images` | `*/5 * * * *` | sharp webp derivatives |
| `alkemart-recompute-sellable-search` | `*/15 * * * *` | Meili safety reindex |

Ensure the API process runs Medusa workers (same `medusa start` with Redis). Install **`sharp`** with the API package for image derivatives.

## Local (Linux worktrees preferred under WSL)

**Neon / WSL note:** If Medusa hangs on “Creating server” with `ETIMEDOUT` to Neon, IPv6 is usually the culprit. The API loads `src/lib/force-ipv4-dns.ts` first to force IPv4 DNS. Refresh credentials with `bun run neon:connect`.

```bash
# API
cd /home/amber/alkemart-backend && bun run dev   # :9000

# Storefront
cd /home/amber/alkemart-storefront && bun run dev  # :5175
# or monorepo:
bun run dev:storefront:linux

# Lab fixtures
cd packages/api
bunx medusa exec ./src/scripts/ensure-lab-commerce.ts
bunx medusa exec ./src/scripts/ensure-ghana-categories.ts
```

## Database

Neon database: **`alkemart_marketplace`**.  
Express-era `neondb` is reference only.

## Deploy

1. **Do not** use root `Dockerfile` / `fly.toml` for Express (deprecated stubs).
2. Build/deploy **Mercur backend** from `apps/backend` (`packages/api` Dockerfile as a starting point — fix monorepo lockfile paths for your host).
3. Set production env from checklist above.
4. Run migrations: `bun run backend:migrate` (or Medusa migrate in worktree).
5. Create first admin: `bunx medusa user -e ops@domain -p '…'`
6. Seed categories; configure Ghana region / GHS / sales channel / publishable key.
7. Host storefront static build with CORS matching `STORE_CORS`.
8. Point Paystack webhooks at `POST /hooks/paystack`.

## Seller go-live path (ops)

1. Seller registers at `/seller/register` → shop `pending_approval`
2. Admin **Seller queue** → Approve (or Reject = Mercur suspend)
3. Seller completes location + Ghana shipping → readiness `active`
4. Product `proposed` → Admin **Product review** → Confirm
5. Offer + stock → appears in search / store (sellable)

## Archived (do not deploy)

| Path | Was |
|------|-----|
| `archive/express-api-server-legacy` | Express API |
| `archive/lab-spa-legacy` | Dual-home SPA |
| `archive/express-libs-legacy` | Drizzle / CASL / Orval |
| `archive/alkemart-medusa-legacy` | Half-migrated Medusa |

Full inventory: `archive/README.md`.
