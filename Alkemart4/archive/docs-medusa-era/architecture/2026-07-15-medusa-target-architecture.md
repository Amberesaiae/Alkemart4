# Medusa Target Architecture (pointer)

| Field | Value |
|---|---|
| **Date** | 2026-07-15 (pointer updated 2026-07-16) |
| **Status** | **Superseded for implementation path** by clean-slate ADR |
| **Supersedes (runtime)** | Dual-homed SPA → Express + Medusa half-migration |
| **Does not supersede** | Commercial spine ADRs in `2026-07-13-alkemart-architecture-and-commercial-spine.md` |

## Clean slate (2026-07-16)

**Do not continue building production features in `alkemart-medusa/`.**

Canonical decision: [`2026-07-16-clean-slate-backend.md`](./2026-07-16-clean-slate-backend.md)

- Archive current Medusa tree → `archive/alkemart-medusa-legacy/`
- New sole backend → `apps/backend` (Mercur on Medusa + Alkemart Paystack/region adapters)
- Express remains reference only; not a second write path

Commercial money/MoMo/settlement rules still bind; only the code home is new.

## Relationship between docs

1. **Clean-slate backend** (`2026-07-16-clean-slate-backend.md`) — **active implementation path**.
2. **Commercial spine** (`2026-07-13-…`) — money, MoMo async, cancel, settlements, outbox ADRs. Still binding.
3. **Migration status** (`spec/2026-07-15-medusa-migration-spec.md`) — historical as-built of the legacy tree.
4. **Production plan** (`docs/superpowers/plans/2026-07-15-alkemart-neon-medusa-paystack-production-plan.md`) — Neon + Paystack goals still relevant; **delivery vehicle** is the new backend, not the old tree.
5. **Earlier plumbing plan** — historical only.
6. **Frontend hardcode audit / UX** under `docs/superpowers/specs/` — UI non-regression rules.

## One-sentence strategy

**Neon** is the database; **fresh Medusa+Mercur** is the commerce/marketplace API; **Paystack Ghana** is the paid path; SPA keeps UI and rewires to one API; Express and legacy Medusa are archived reference.

## Canonical code locations

| Concern | Path |
|---|---|
| Backend (new, sole runtime) | `apps/backend/` (after scaffold) |
| Legacy Medusa (frozen) | `archive/alkemart-medusa-legacy/` (was `alkemart-medusa/`) |
| SPA | `artifacts/alkemart/` |
| Express reference | `artifacts/api-server/`, `lib/db/` — not SPA production write path |
| Shared non-secret config | `lib/platform-config/` |
