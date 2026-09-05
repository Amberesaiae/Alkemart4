# Ops runbook — Workers

Railway / Medusa runbook archived at `archive/docs-medusa-era/ops/runbook.md`.

## Health

```bash
curl -sS https://alkemart-api.glean-circular-passport.workers.dev/health
curl -sS https://alkemart-api.glean-circular-passport.workers.dev/health/ready
```

Ready checks Postgres (Hyperdrive) and Paystack config (Paystack may report `degraded` if secret missing — do not treat as hard-fail for non-payment reads).

## Deploy

See root `DEPLOYMENT.md`.

```bash
cd apps/api && npx wrangler deploy
# Pages: rebuild with VITE_ALKEMART_API_URL set, then wrangler pages deploy
```

## Logs

```bash
cd apps/api && npx wrangler tail
```

## Schema patches

When laptop cannot reach Supabase:

1. Admin login → JWT  
2. `POST /admin/migrate/schema`  
3. Specific one-shots as needed (`shipping-address`, `link-demo-vendor-to-seller-a`)

Prefer `packages/db` drizzle migrate when `DATABASE_URL` works.

## Smoke

```bash
./scripts/e2e-workers-smoke.sh
./scripts/e2e-workers-acid.sh
```

## CORS

See `docs/ops/cors-and-origins.md`.
