# Neon (Alkemart)

Canonical layout, ADR-P1 (dedicated Medusa DB/branch), env contract (`DATABASE_URL` vs `EXPRESS_DATABASE_URL`), and `neonctl` branch creation steps:

→ **[docs/architecture/2026-07-15-neon-database-layout.md](./architecture/2026-07-15-neon-database-layout.md)**

**Summary**

| Today | Target |
|---|---|
| Express + Medusa share `neondb` (transitional) | Medusa → `alkemart_medusa` (or dedicated branch); Express stays until cutover |

| Env var | Use |
|---|---|
| `DATABASE_URL` | Medusa runtime (prefer Neon **pooled** host) |
| `EXPRESS_DATABASE_URL` | ETL source only — never Medusa runtime |

Never commit connection strings. Agents without `NEON_API_KEY` must not run interactive `neonctl auth`.
