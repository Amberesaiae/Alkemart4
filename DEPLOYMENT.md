# Alkemart Deployment Plan

> **2026-07-17:** Express dual-home is **archived**. Production direction is Mercur/Medusa + greenfield SPA.  
> See `docs/architecture/2026-07-16-clean-slate-backend.md` and `docs/architecture/2026-07-17-dead-project-cleanup.md`.

## Live architecture (lab / Mode B)

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  Buyer SPA          │     │  apps/backend            │     │  Neon PG     │
│  apps/storefront    │────▶│  Mercur + Medusa         │────▶│  alkemart_   │
│  :5175              │     │  :9000                   │     │  marketplace │
└─────────────────────┘     │  /seller  /dashboard     │     └──────────────┘
                            └──────────────────────────┘
```

| Surface | Path | Port |
|---------|------|------|
| Buyers | `apps/storefront` | 5175 |
| Sellers | Mercur Vendor panel | 9000 `/seller` |
| Admins | Mercur Admin | 9000 `/dashboard` |
| API | Mercur/Medusa | 9000 |

## Local (Linux worktrees preferred under WSL)

```bash
# API
cd /home/amber/alkemart-backend && bun run dev   # :9000

# Storefront
cd /home/amber/alkemart-storefront && bun run dev  # :5175
# or from monorepo:
bun run dev:storefront:linux
```

## Database

Neon project / database: **`alkemart_marketplace`** (clean Mercur backend).

Express-era `neondb` / `EXPRESS_DATABASE_URL` are **ETL/reference only** — not the SPA write path.

## Deploy (not Express)

- **Do not** use root `Dockerfile` / `fly.toml` as-is for Express (they refuse or are stubs).
- Deploy **Mercur backend** from `apps/backend` (or Linux worktree) with platform env:
  - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`
  - publishable key / CORS for storefront origin
- Host buyer SPA as static Vite build (`apps/storefront` → Cloudflare Pages / similar).

## Archived (do not deploy)

| Path | Was |
|------|-----|
| `archive/express-api-server-legacy` | Express API on :3000 |
| `archive/lab-spa-legacy` | Dual-home lab SPA |
| `archive/express-libs-legacy` | Drizzle schema, CASL, Orval client |
| `archive/alkemart-medusa-legacy` | Half-migrated custom Medusa |

Full inventory: `archive/README.md`.
