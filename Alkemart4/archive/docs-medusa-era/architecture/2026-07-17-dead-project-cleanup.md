# Dead project cleanup (dual-home lab stack)

| Field | Value |
|---|---|
| **Date** | 2026-07-17 |
| **Status** | **Done** |
| **Related** | `2026-07-16-clean-slate-backend.md`, `archive/README.md` |

---

## Decision

Remove the dual-home Express + lab SPA from the **active monorepo workspace**. Keep source under `archive/` for reference only.

## What stayed live

| Path | Role |
|------|------|
| `apps/storefront` | Buyer SPA (Mode B COD, port **5175**) |
| `apps/backend` | Mercur + Medusa marketplace API (port **9000**) |
| `scripts/src/neon-connect-backend.ts` | Neon helper for clean backend |
| `scripts/src/backend-sync.ts` / `backend-migrate.ts` | Backend worktree helpers |
| `docs/architecture/*` | ADRs and procedures |

## What moved to `archive/`

| Old path | New path |
|----------|----------|
| `artifacts/alkemart` | `archive/lab-spa-legacy` |
| `artifacts/api-server` | `archive/express-api-server-legacy` |
| `artifacts/mockup-sandbox` | `archive/mockup-sandbox-legacy` |
| `lib/*` | `archive/express-libs-legacy/*` |
| `scripts/src/seed-homepage.ts` | `archive/express-scripts-legacy/seed-homepage.ts` |
| `alkemart-medusa` (earlier) | `archive/alkemart-medusa-legacy` |

`artifacts/` and root `lib/` were removed after the moves.

## Workspace changes

- Root `package.json` workspaces: only `apps/storefront` + `scripts`.
- Default `bun run dev` → greenfield storefront (not lab SPA).
- Removed `dev:lab` and Express-era typecheck of `artifacts/**` / `lib/*`.
- `pnpm-workspace.yaml` no longer lists `artifacts/*` or `lib/*`.
- Root `Dockerfile` / `fly.toml` previously targeted Express — replaced with deprecation stubs pointing at Mercur deploy path.

## Do not resurrect

- Express as concurrent production write path
- Lab SPA admin/vendor dual-home ops
- Workspace members under `archive/`

Cherry-pick only after re-implementing cleanly on Mercur.
