# Alkemart — Production Deployment (Workers)

> **Canonical stack:** Cloudflare Workers API + Hyperdrive + Supabase Postgres + Paystack + three Cloudflare Pages UIs (gold `#FEBF31`).  
> Medusa / Mercur / Railway / Neon deploy history: `archive/docs-medusa-era/root/DEPLOYMENT-medusa-era.md`.

## Topology

```
Browsers
  alkemart4-storefront.pages.dev
  alkemart4-vendor.pages.dev
  alkemart4-admin.pages.dev
           │
           ▼  VITE_ALKEMART_API_URL
  alkemart-api…workers.dev  (Hono)
           │
     ┌─────┼──────────┬────────────┐
     ▼     ▼          ▼            ▼
 Hyperdrive×2      CATALOG_KV    Paystack
 (catalog+primary) (cache/dedup) (MoMo/card/payout)
     │
     ▼
  Supabase Postgres (alkemart, eu-west-1)
```

## Deploy API

```bash
cd apps/api
npx wrangler deploy
```

Bindings in `apps/api/wrangler.toml`:

- `HYPERDRIVE` — catalog / cached reads  
- `HYPERDRIVE_PRIMARY` — auth, checkout, stock, payouts  
- `CATALOG_KV` — catalog cache + webhook dedup  
- `MEDIA_BUCKET` (R2 `alkemart-media`) — product / logo / banner uploads  
- `IMAGES` — upload conversion pipeline (≤1600px WebP + 400px thumb)

One-time media setup (needs `wrangler login`):

```bash
cd apps/api
npx wrangler r2 bucket create alkemart-media
# Images binding needs no setup beyond wrangler.toml — enable Images on the
# account if the dashboard prompts. Without it uploads still work but store
# the original file only (no WebP variants).
npx wrangler deploy
```

Media endpoints: `POST /vendor/uploads` (seller auth, multipart `files`,
optional `kind` in products|logos|banners) and `POST /admin/uploads` (admin
auth, merch art for Homepage Studio) → `{ files: [{ url, variants }] }`;
public `GET /media/*` with immutable caching.

Secrets (Wrangler):

- `JWT_SECRET` (≥32 chars)  
- `PAYSTACK_SECRET_KEY`  
- Optional vars: `ALLOWED_ORIGINS` (comma-separated extra CORS origins), `ENVIRONMENT`
- Optional SMS (fulfillment notifications): `AT_USERNAME` + `AT_API_KEY` (Africa's Talking; sender ID via `AT_SENDER_ID`, NCA-registered before prod). Absent → log-only stub; dispatch via cron or `POST /admin/migrate/send-notifications`

Webhook URL: `https://<worker>/hooks/paystack`

Health: `GET /health`, `GET /health/ready`

## Deploy UIs (Pages)

Build each app with:

```bash
export VITE_ALKEMART_API_URL=https://alkemart-api.glean-circular-passport.workers.dev
```

Vendor/admin preview iframes point at the storefront via
`VITE_ALKEMART_STOREFRONT_URL` (defaults to `http://127.0.0.1:5175` for local
dev). Set it to the production storefront origin for Pages builds, or live
previews will point at localhost:

```bash
export VITE_ALKEMART_STOREFRONT_URL=https://alkemart4-storefront.pages.dev
```

| App | Build from | Pages project |
|-----|------------|---------------|
| Storefront | `apps/storefront-v2` | `alkemart4-storefront` |
| Vendor | `apps/vendor-v2` | `alkemart4-vendor` |
| Admin | `apps/admin-v2` | `alkemart4-admin` |

The v2 apps are the live UIs (pilot build, 2026-09-27). `apps/storefront` and
`apps/backend/apps/*` are **retired**: never build or deploy them. Each v2 app
ships `public/_redirects` (`/* /index.html 200`) so deep links work on Pages.
Before deploying the pilot, read `docs/architecture/workers/HANDOFF.md`
(migrations 0036–0049, Paystack live setup).

Do **not** set `VITE_MEDUSA_*` for production Pages builds.

## Schema / migrate

Use the repository runner, `DATABASE_URL="<connection URL>" bun run db:migrate`.
Do not use `supabase db push` or Drizzle's journal: these hand-written SQL files
are tracked by their full filename (without `.sql`) in `schema_migrations`.

Before running it, read **all** rows with
`SELECT version FROM public.schema_migrations ORDER BY version;` and compare
them with every SQL filename in `packages/db/src/migrations`. The runner
applies each missing filename; the latest recorded version alone does not
prove that earlier migrations are recorded. If an existing schema has missing
history, verify its tables and columns before recording any baseline.

Take a database backup containing both schema and data first. A default
`supabase db dump` is schema-only; dump data separately or use `pg_dump -Fc`
and verify the archive with `pg_restore --list`. Keep backups outside Git.
Use the direct database endpoint on port 5432, or the **session** pooler on
port 5432 when IPv6 is unavailable. Do not migrate through the transaction
pooler on port 6543. Each migration and its ledger insert run in one transaction.

When the laptop cannot reach Supabase (IPv6/pooler issues), use admin one-shots (admin JWT required):

- `POST /admin/migrate/schema`
- `POST /admin/migrate/shipping-address`
- `POST /admin/migrate/link-demo-vendor-to-seller-a`
- `POST /admin/migrate/rotate-demo-passwords` (requires body with new passwords — see ops)

## Smoke (API — not browser)

```bash
./scripts/e2e-workers-smoke.sh
./scripts/e2e-workers-acid.sh   # fuller ACID lifecycles
```

Browser Playwright is deferred. Use `docs/architecture/workers/NAV-MATRIX.md` for manual UI checks.

## Docs (canonical)

- Agents: `docs/architecture/workers/AGENT-PLAYBOOK.md` + `LOCAL-DEV.md`
- Architecture: `docs/architecture/workers/`
- Ops: `docs/ops/`
- Demo accounts: `docs/DEMO-ACCOUNTS.md`
- Root: `README.md`, `AGENTS.md`
- Archives (ignore for implement): `archive/docs-medusa-era/`, `archive/docs-historical/`
