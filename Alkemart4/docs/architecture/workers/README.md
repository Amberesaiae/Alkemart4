# Workers architecture (canonical)

**Status:** Living — sole production write path  
**Stack:** Cloudflare Workers (`apps/api`) + dual Hyperdrive + Supabase Postgres + Paystack + three gold Pages UIs (`#FEBF31`)

Medusa / Mercur / Railway / Neon and other unreliable docs live under `archive/`. **Do not implement against archive.**

## Start here (agents)

| Doc | Covers |
|-----|--------|
| [AGENT-PLAYBOOK.md](./AGENT-PLAYBOOK.md) | **Distinct implementation approach** — what to touch, steps A–D |
| [LOCAL-DEV.md](./LOCAL-DEV.md) | Ports, env, `bun run dev:workers` |
| [ACID-DATAFLOW.md](./ACID-DATAFLOW.md) | Topology, entities, Hyperdrive, ACID hotspots |
| [LIFECYCLE-BUYER.md](./LIFECYCLE-BUYER.md) | Auth → browse → cart → checkout → orders |
| [LIFECYCLE-VENDOR.md](./LIFECYCLE-VENDOR.md) | Register → approve → Ghana MoMo → catalog → fulfill |
| [LIFECYCLE-ADMIN.md](./LIFECYCLE-ADMIN.md) | Sellers, products, orders, payouts, migrate |
| [LIFECYCLE-PAYMENT.md](./LIFECYCLE-PAYMENT.md) | COD / MoMo / card, webhook + poll, stock, idempotency |
| [NAV-MATRIX.md](./NAV-MATRIX.md) | Every Workers-visible route + manual click paths |
| [ENGINEERING-STANDARDS.md](./ENGINEERING-STANDARDS.md) | Backend-first + frontend production practices |

## Companion ops

- `docs/DEMO-ACCOUNTS.md`
- `docs/ops/LAUNCH-GATE-STATUS.md`
- `docs/ops/PAYMENTS-LAUNCH-GATE.md`
- `docs/ops/supabase-hyperdrive-setup.md`
- `docs/ops/runbook.md` / `rollback.md` / `cors-and-origins.md`
- Design: `docs/superpowers/specs/2026-08-31-cloudflare-ghana-marketplace-design.md`
- Short map: `docs/superpowers/specs/2026-09-01-cloudflare-e2e-architecture.md`
- Money ADRs (still binding): `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md`

## Live surfaces

| Surface | Code | Pages |
|---------|------|-------|
| Storefront | `apps/storefront` | https://alkemart4-storefront.pages.dev |
| Vendor | `apps/backend/apps/ghana-vendor` | https://alkemart4-vendor.pages.dev |
| Admin | `apps/backend/apps/admin` | https://alkemart4-admin.pages.dev |
| API | `apps/api` | https://alkemart-api.glean-circular-passport.workers.dev |

All three UIs bake `VITE_ALKEMART_API_URL` to the Worker.
