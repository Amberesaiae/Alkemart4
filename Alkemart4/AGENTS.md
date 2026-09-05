# Alkemart4 — agent notes

## Canonical stack (do not ignore)

- **API:** Cloudflare Workers Hono — `apps/api`
- **DB:** Supabase Postgres via dual Hyperdrive
- **Payments:** Paystack only (MoMo / card / transfers)
- **UIs (gold `#FEBF31`):**
  - Storefront `apps/storefront` → Pages `alkemart4-storefront`
  - Vendor `apps/backend/apps/ghana-vendor` → `alkemart4-vendor`
  - Admin `apps/backend/apps/admin` → `alkemart4-admin`
- **Docs SoR:** `docs/architecture/workers/`
- **Ops:** `docs/ops/`, `docs/DEMO-ACCOUNTS.md`, root `DEPLOYMENT.md`

**Medusa / Mercur / Railway / Neon are archived.** See `archive/docs-medusa-era/` and `archive/alkemart-medusa-legacy/`. Do not implement features against archived docs. Do not revive dual writers.

Live API: `https://alkemart-api.glean-circular-passport.workers.dev`

## Rules of engagement

1. Workers is the only commerce write path.  
2. Pesewas integers; ATC binds `offerId`.  
3. Production UI builds require `VITE_ALKEMART_API_URL`.  
4. No sludge/OSS shell swaps for vendor/admin.  
5. Verify UI changes with real click paths when browser tools exist.  
6. Do not push to origin unless the human asks.  

## Ghana locale

`packages/shared` (`@alkemart/shared/ghana`) is canonical for Ghana geography, currency, phone, MoMo providers.

## UI primitives

Prefer `@workspace/ui` (`EmptyState`, `Price`, `Card`, `Badge`, `Table`, `Button`, `Skeleton`).

## Smoke

```bash
./scripts/e2e-workers-smoke.sh
./scripts/e2e-workers-acid.sh
```
