# Alkemart

Ghana-first multivendor marketplace.

## Canonical stack

| Layer | Technology |
|-------|------------|
| API | Cloudflare Workers (`apps/api`) |
| DB | Supabase Postgres via dual Hyperdrive |
| Payments | Paystack (MoMo / card / transfers) |
| UIs | Storefront · Vendor · Admin (gold `#FEBF31`) on Cloudflare Pages |

**Medusa / Mercur / Railway / Neon are not the write path.** See `archive/`.

## Agents — start here

1. [`docs/architecture/workers/AGNOSTIC-APPROACH.md`](docs/architecture/workers/AGNOSTIC-APPROACH.md) — **owned kernel doctrine** (why we left Medusa, Product≠Offer, Paystack, single writer)  
2. [`docs/architecture/workers/AGENT-PLAYBOOK.md`](docs/architecture/workers/AGENT-PLAYBOOK.md) — how to implement  
3. [`docs/architecture/workers/LOCAL-DEV.md`](docs/architecture/workers/LOCAL-DEV.md) — local ports and env  
4. [`docs/architecture/workers/`](docs/architecture/workers/) — ACID + lifecycles + nav matrix  
5. [`AGENTS.md`](AGENTS.md) — short rules  
6. [`DEPLOYMENT.md`](DEPLOYMENT.md) — production deploy  

Ignore everything under `archive/`.

## Local quick start

```bash
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # set JWT_SECRET
# set VITE_ALKEMART_API_URL=http://127.0.0.1:8787 in each UI .env.local
bun run dev:workers
```

| App | URL |
|-----|-----|
| API | http://127.0.0.1:8787 |
| Storefront | http://127.0.0.1:5175 |
| Vendor | http://127.0.0.1:3002 |
| Admin | http://127.0.0.1:3001 |

## Live (reference)

- API: `https://alkemart-api.glean-circular-passport.workers.dev`  
- Store: `https://alkemart4-storefront.pages.dev`  
- Vendor: `https://alkemart4-vendor.pages.dev`  
- Admin: `https://alkemart4-admin.pages.dev`  
- Accounts: `docs/DEMO-ACCOUNTS.md`  
