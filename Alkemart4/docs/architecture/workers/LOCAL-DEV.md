# Local development — Workers + gold UIs

## Ports

| Process | Port | Command |
|---------|------|---------|
| API (Wrangler) | **8787** | `bun run dev:api` |
| Storefront | **5175** | `bun run dev:storefront` |
| Vendor | **3002** | `bun run dev:vendor` |
| Admin | **3001** | `bun run dev:admin` |

One-shot (all four):

```bash
bun run dev:workers
```

Stop with Ctrl-C (script traps child processes).

## Prerequisites

1. `bun install` from repo root (`Alkemart4/`).  
2. Cloudflare login for Hyperdrive bindings: `cd apps/api && bunx wrangler login`  
3. API secrets file (gitignored):

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
# edit JWT_SECRET (≥32 chars). Paystack optional for COD-only local.
```

4. UI env files (gitignored) — Workers URL must point at local API:

**Storefront** `apps/storefront/.env.local`:

```bash
VITE_ALKEMART_API_URL=http://127.0.0.1:8787
VITE_VENDOR_APP_URL=http://127.0.0.1:3002
VITE_ADMIN_APP_URL=http://127.0.0.1:3001
VITE_HOME_DEMO=0
```

**Vendor** `apps/backend/apps/ghana-vendor/.env.local`:

```bash
VITE_ALKEMART_API_URL=http://127.0.0.1:8787
```

**Admin** `apps/backend/apps/admin/.env.local`:

```bash
VITE_ALKEMART_API_URL=http://127.0.0.1:8787
```

Templates: `apps/storefront/.env.template`, `apps/backend/apps/{ghana-vendor,admin}/.env.template`.

## How requests flow locally

```
Browser :5175 / :3001 / :3002
        │  VITE_ALKEMART_API_URL
        ▼
Wrangler :8787  (apps/api)
        │  Hyperdrive bindings (remote pool → Supabase)
        ▼
Postgres (alkemart)
```

Vite proxies for `/store`, `/vendor`, `/admin` also target `127.0.0.1:8787` as a fallback when the client uses relative paths. Prefer the absolute Workers URL.

## Smoke against local API

```bash
ALKEMART_API_URL=http://127.0.0.1:8787 ./scripts/e2e-workers-smoke.sh
ALKEMART_API_URL=http://127.0.0.1:8787 ./scripts/e2e-workers-acid.sh
```

Omit Pages checks by exporting `SKIP_PAGES=1` if the acid script supports it (or run smoke only).

## Demo accounts

See `docs/DEMO-ACCOUNTS.md` (`buyer@` / `vendor@` / `admin@alkemart.test`). Same DB as live Hyperdrive unless you point Hyperdrive elsewhere.

## Common failures

| Symptom | Fix |
|---------|-----|
| UI still hits Medusa / `:9000` | Set `VITE_ALKEMART_API_URL`; restart Vite |
| Wrangler missing secret | Create `apps/api/.dev.vars` from example |
| Hyperdrive / DB errors | `wrangler login`; check binding IDs in `apps/api/wrangler.toml` |
| `wrangler` fetch failed / whoami hangs | Prefer IPv4. For Workers: `NODE_OPTIONS='--dns-result-order=ipv4first' wrangler deploy`. For Pages on broken IPv6 networks use the preload: `NODE_OPTIONS="--dns-result-order=ipv4first -r $PWD/scripts/node-ipv4-fetch-preload.cjs" wrangler pages deploy …` or `bun run deploy:pages` |
| CORS browser errors | Ensure origin is localhost port above; see `docs/ops/cors-and-origins.md` |
| Wrong brand / sludge shells | Do not run `archive/workers-shell-*-sludge` |

## Not local-dev

- `bun run dev:backend` / Medusa on `:9000` — **do not use**  
- Neon/Railway helper scripts in old smoke targets — removed from root scripts  
