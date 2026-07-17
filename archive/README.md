# Archive (reference only)

**Nothing under `archive/` is a production write path.** Do not run these as the live marketplace.

Canonical live stack:

| Role | Path | Port |
|------|------|------|
| Buyer SPA | `apps/storefront` | **5175** |
| Mercur/Medusa API + seller/admin | `apps/backend` (Linux worktree: `/home/amber/alkemart-backend`) | **9000** |
| Neon | `alkemart_marketplace` | — |

ADR: `docs/architecture/2026-07-16-clean-slate-backend.md`  
Cleanup: `docs/architecture/2026-07-17-dead-project-cleanup.md`

---

## Contents (frozen 2026-07-17)

| Path | What it was | Status |
|------|-------------|--------|
| `alkemart-medusa-legacy/` | Half-migrated custom Medusa (customer-roles, store alkemart routes, Ghana modules) | Frozen 2026-07-16 |
| `lab-spa-legacy/` | Dual-home Express/Medusa lab SPA (`@workspace/alkemart`, was `artifacts/alkemart`) | Frozen — superseded by `apps/storefront` |
| `express-api-server-legacy/` | Express + Drizzle marketplace API (`@workspace/api-server`) | Frozen — reference / ETL ideas only |
| `express-libs-legacy/` | Shared Express stack (`db`, `abilities`, `api-zod`, `api-client-react`, `api-spec`, `platform-config`) | Frozen with Express |
| `mockup-sandbox-legacy/` | Replit mockup sandbox | Frozen |
| `express-scripts-legacy/` | Express-era seeds (e.g. homepage seed) | Frozen |

## Rules

1. Do **not** run archive apps as the live marketplace API or buyer storefront.
2. Do **not** add new features here.
3. Do **not** re-add `artifacts/*` or `lib/*` to root Bun/pnpm workspaces.
4. Cherry-pick ideas (Paystack helpers, seed scripts, port inventory) into `apps/backend` or `apps/storefront` only after re-implementing cleanly against Mercur/Medusa.
5. History is preserved via git renames where possible; restore with `git checkout` / `git mv` if needed.

## Outside-repo Linux leftovers (optional manual cleanup)

These are **not** in the monorepo; remove only if you no longer need them:

| Path | Notes |
|------|--------|
| `/home/amber/alkemart-spa` | Old lab SPA Linux copy |
| `/home/amber/alkemart-medusa` | Old Medusa tree Linux copy |
| `/home/amber/alkemart-storefront` | **Keep** — live Linux Vite worktree |
| `/home/amber/alkemart-backend` | **Keep** — live Mercur worktree |
