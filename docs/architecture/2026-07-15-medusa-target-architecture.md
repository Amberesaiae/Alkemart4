# Medusa Target Architecture (pointer)

| Field | Value |
|---|---|
| **Date** | 2026-07-15 |
| **Status** | Planning — not yet production |
| **Supersedes (runtime)** | Dual-homed SPA → Express + Medusa half-migration |
| **Does not supersede** | Commercial spine ADRs in `2026-07-13-alkemart-architecture-and-commercial-spine.md` |

## Relationship between docs

1. **Commercial spine** (`2026-07-13-…`) — money, MoMo async, cancel, settlements, outbox ADRs. Still binding.
2. **Migration status** (`spec/2026-07-15-medusa-migration-spec.md`) — as-built partial Medusa work + known breakage.
3. **Production plan** (`docs/superpowers/plans/2026-07-15-medusa-production-readiness.md`) — **execution source of truth**.
4. **Frontend hardcode audit / UX** under `docs/superpowers/specs/` — UI non-regression rules.

## One-sentence strategy

Medusa owns commodity commerce; Alkemart ports its ACID commercial spine into Medusa modules/workflows; the SPA keeps its UI and talks only through a typed commerce domain layer with zero hardcodes.

## Canonical code locations

| Concern | Path |
|---|---|
| Medusa backend (git) | `alkemart-medusa/apps/backend/` |
| SPA | `artifacts/alkemart/` |
| Express reference (port then archive) | `artifacts/api-server/`, `lib/db/` — freeze as reference, not SPA production runtime; port inventory: `express-port-inventory.md` |
| Shared non-secret config | `lib/platform-config/` (to create) |
