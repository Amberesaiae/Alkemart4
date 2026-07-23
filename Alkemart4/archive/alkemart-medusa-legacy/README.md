# Alkemart Medusa Backend

Source of truth: this directory in the Alkemart4 monorepo.
Do not edit `/home/amber/alkemart-medusa` except as a runtime worktree synced **FROM** here.

## Layout

| Path | Role |
|------|------|
| `apps/backend/` | Medusa v2 API (system of record for catalog, cart, orders, custom modules) |
| `apps/backend/src/modules/` | Custom modules (e.g. `marketplace`) |
| `apps/backend/src/modules/marketplace/migrations/` | MikroORM migrations for marketplace tables |

There is no storefront app in this tree; the Alkemart SPA lives under the monorepo `artifacts/` workspace.

## Stack

- **Medusa:** 2.17.2 (`@medusajs/medusa` and related packages)
- **Runtime:** Node.js ≥ 20
- **Package manager:** bun (workspace root) / npm lockfile present for backend install paths

## Operational rule (WSL)

1. **Canonical source:** `/mnt/c/src/Alkemart4/alkemart-medusa` (git-tracked).
2. **Runtime worktree (optional, WSL perf):** `/home/amber/alkemart-medusa` — install deps and run `medusa develop` here if NTFS/`/mnt/c` I/O is too slow.
3. **Sync direction after cutover:** monorepo → home only. Never copy source back from home into the monorepo without an explicit review (risk of overwriting git source of truth).

### Sync monorepo → home (runtime)

```bash
# From monorepo root
rsync -a --delete \
  --exclude node_modules \
  --exclude .medusa \
  --exclude dist \
  --exclude .env \
  alkemart-medusa/ /home/amber/alkemart-medusa/
```

Then install and run under the home tree if needed:

```bash
cd /home/amber/alkemart-medusa/apps/backend
# ensure .env is present locally (never commit)
npm install   # or bun install from workspace root
npm run dev
```

## Getting started (from monorepo)

```bash
cd alkemart-medusa/apps/backend
cp .env.template .env   # fill secrets; never commit .env
# install deps at workspace or app level
npm run dev             # medusa develop on :9000 by default
```

See Medusa docs: https://docs.medusajs.com
