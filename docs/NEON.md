# Neon (Alkemart)

Canonical layout, ADR-P1 (dedicated Medusa DB/branch), env contract (`DATABASE_URL` vs `EXPRESS_DATABASE_URL`), and `neonctl` branch creation steps:

→ **[docs/architecture/2026-07-15-neon-database-layout.md](./architecture/2026-07-15-neon-database-layout.md)**  
→ **Clean-slate backend:** [docs/architecture/2026-07-16-clean-slate-backend.md](./architecture/2026-07-16-clean-slate-backend.md)

**Summary (2026-07-16 clean slate)**

| Consumer | Target |
|---|---|
| **`apps/backend`** (Mercur/Medusa sole commerce API) | Dedicated Neon **database or branch**, e.g. `alkemart_marketplace` — set in `apps/backend/packages/api/.env` as `DATABASE_URL` (pooled) |
| Express (`archive/express-api-server-legacy`) | `EXPRESS_DATABASE_URL` / legacy `neondb` — **archived ETL/reference only**, not SPA production write path |
| Archived Medusa | Do not point new app at half-migrated legacy schemas |

| Env var | Use |
|---|---|
| `DATABASE_URL` | **New** backend runtime only (`apps/backend/packages/api`) — prefer Neon **pooled** host |
| `EXPRESS_DATABASE_URL` | Express/ETL source only — never the new Medusa runtime |

Never commit connection strings. Agents without `NEON_API_KEY` must not run interactive `neonctl auth`.
