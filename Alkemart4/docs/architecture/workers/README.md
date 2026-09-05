# Workers architecture (canonical)

**Status:** Living — sole production write path  
**Stack:** Cloudflare Workers (`apps/api`) + dual Hyperdrive + Supabase Postgres + Paystack + three gold Pages UIs (`#FEBF31`)

Medusa / Mercur / Railway / Neon and other unreliable docs live under `archive/`. **Do not implement against archive.**

---

## Start here (agents)

| Order | Doc | Covers |
|------:|-----|--------|
| 1 | [AGNOSTIC-APPROACH.md](./AGNOSTIC-APPROACH.md) | **Doctrine so far** — what agnostic means, decisions, rejected patterns, honesty about gaps |
| 2 | [AGENT-PLAYBOOK.md](./AGENT-PLAYBOOK.md) | How to implement a change (steps A–D) |
| 3 | [LOCAL-DEV.md](./LOCAL-DEV.md) | Ports, env, `bun run dev:workers` |
| 4 | [ACID-DATAFLOW.md](./ACID-DATAFLOW.md) | Topology, entities, Hyperdrive, ACID hotspots |
| 5 | Matching lifecycle | Buyer / vendor / admin / payment (below) |
| 6 | [NAV-MATRIX.md](./NAV-MATRIX.md) | Workers-visible routes + manual clicks |
| 7 | [ENGINEERING-STANDARDS.md](./ENGINEERING-STANDARDS.md) | Backend-first + frontend practices |

---

## Lifecycles

| Doc | Covers |
|------|--------|
| [LIFECYCLE-BUYER.md](./LIFECYCLE-BUYER.md) | Auth → browse → cart → checkout → orders |
| [LIFECYCLE-VENDOR.md](./LIFECYCLE-VENDOR.md) | Register → approve → Ghana MoMo → catalog → fulfill |
| [LIFECYCLE-ADMIN.md](./LIFECYCLE-ADMIN.md) | Sellers, products, orders, payouts, migrate |
| [LIFECYCLE-PAYMENT.md](./LIFECYCLE-PAYMENT.md) | COD / MoMo / card, webhook + poll, stock, idempotency |

---

## Companion ops (outside this folder)

- `docs/DEMO-ACCOUNTS.md`
- `docs/ops/` — launch gates, Hyperdrive, CORS, runbook, payments matrix
- Root `README.md`, `AGENTS.md`, `DEPLOYMENT.md`
- Money ADRs (still binding): `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md`
- Design reference only: `docs/superpowers/specs/2026-08-31-*.md`, `2026-09-01-cloudflare-e2e-architecture.md`

## Live surfaces

| Surface | Code | Pages |
|---------|------|-------|
| Storefront | `apps/storefront` | https://alkemart4-storefront.pages.dev |
| Vendor | `apps/backend/apps/ghana-vendor` | https://alkemart4-vendor.pages.dev |
| Admin | `apps/backend/apps/admin` | https://alkemart4-admin.pages.dev |
| API | `apps/api` | https://alkemart-api.glean-circular-passport.workers.dev |
