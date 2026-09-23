# Alkemart4 — agent notes

## Canonical stack

- **API:** `apps/api` (Cloudflare Workers / Hono)  
- **DB:** Supabase Postgres via Hyperdrive  
- **Payments:** Paystack only  
- **UIs:** `apps/storefront` · `apps/backend/apps/ghana-vendor` · `apps/backend/apps/admin`  
- **Brand:** gold `#FEBF31`  

**Medusa / Mercur / Railway / Neon are not production writers.** Ignore `archive/**`.

## Required reading (in order)

1. [`docs/architecture/workers/AGNOSTIC-APPROACH.md`](docs/architecture/workers/AGNOSTIC-APPROACH.md) — doctrine so far  
2. [`docs/architecture/workers/AGENT-PLAYBOOK.md`](docs/architecture/workers/AGENT-PLAYBOOK.md) — how to implement  
3. [`docs/architecture/workers/LOCAL-DEV.md`](docs/architecture/workers/LOCAL-DEV.md) — local serving  
4. Matching lifecycle under [`docs/architecture/workers/`](docs/architecture/workers/)  
5. [`README.md`](README.md) · [`DEPLOYMENT.md`](DEPLOYMENT.md) · [`docs/ops/`](docs/ops/)  

## Local

```bash
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars
# UI .env.local → VITE_ALKEMART_API_URL=http://127.0.0.1:8787
bun run dev:workers
```

| Service | Port |
|---------|------|
| API | 8787 |
| Storefront | 5175 |
| Vendor | 3002 |
| Admin | 3001 |

## Rules

1. Workers is the only commerce write path.  
2. Pesewas integers; ATC binds `offerId`.  
3. Production/UI builds need `VITE_ALKEMART_API_URL`.  
4. No sludge shells; no Medusa dual-path for new features.  
5. Update the matching lifecycle doc when behavior changes.  
6. Stay on `main`. Do not push unless asked.  
7. Verify UI with real click paths when you change user-visible surfaces.  

## Smoke

```bash
bun run smoke          # live Worker + Pages
bun run smoke:acid
bun run smoke:local    # local API :8787 (SKIP_PAGES)
```

## Tests (worker cap is load-bearing)

```bash
bun run test:api       # 45 files — capped at 2 workers, do NOT uncap
bun run test:domain
```

Uncapped, 45 isolates starve small dev boxes and tests fail
non-deterministically (different files each run; every file passes alone).
Per vitest docs: right-size workers to the machine, keep isolate:true
(singletons like the rate limiter must not leak across files). If you have
a bigger box, override per-run (`--maxWorkers=4`), don't edit the scripts.

## Ghana locale

`packages/shared` (`@alkemart/shared/ghana`) is canonical for geography, currency, phone, MoMo providers.
