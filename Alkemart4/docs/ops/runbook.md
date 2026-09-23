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

## SEO + feeds (Phase 6)

- Prerender: `bun run build:seo` in `apps/storefront` with
  `VITE_ALKEMART_API_URL` + `VITE_PUBLIC_SITE_URL` (https, production
  origin) set. Emits shells (product/category/shop/collection),
  `sitemap*.xml`, and `feed.xml` into `dist/`. Refuses localhost origins.
- Live sources: `GET /store/sitemap` (indexable truth), `GET /store/feed`
  (merchant rows), `GET /admin/feed/diagnostics` (agreement + exclusions).
- Monitoring (weekly): Search Console index coverage + crawl errors;
  structured-data validation (Rich Results Test on a product/category/shop
  sample); feed disapprovals in Merchant Center; 404 rate on `/product/*`
  (removed listings must 410/message, never redirect home).
- Rollback: revert new routes to CSR + `noindex` (ADR-006).

## Governance (Phase 0)

- Taxonomy owner: approves node create/update/deprecate and reviews the
  `GET /admin/taxonomy/proposals/review` queue weekly (Other-bucket,
  thin leaves, rejected matches). No auto-apply, ever.
- Promotion approver: campaign `submit → approve → publish` requires a
  second admin (creator cannot approve their own campaign); paid
  (Sponsored) placements get extra scrutiny on claims.
- Trust-label issuer: verification issue/revoke is admin-only, reasoned,
  and audit-logged. "Verified" never implies more than the evidence row.
- Two-person rule: payouts (`POST /admin/payouts`), payout holds, and
  trust changes need a second pair of eyes — the audit log must show two
  distinct admin user IDs before money moves.
- Review SLAs: moderation + appeals + reviews queues cleared within 2
  business days; expired campaigns auto-offline but get a human glance
  weekly via the campaigns list (`status=ended`).
