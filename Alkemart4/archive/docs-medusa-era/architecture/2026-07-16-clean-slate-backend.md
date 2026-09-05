# ADR: Clean-slate marketplace backend

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | **Accepted** — direction locked by product |
| **Supersedes (implementation path)** | Incremental patch of `alkemart-medusa/apps/backend` dual-home modules |
| **Does not supersede** | Commercial spine (money, MoMo async, cancel, settlements) in `2026-07-13-alkemart-architecture-and-commercial-spine.md` |
| **Related** | Marketplace diagnosis, RBAC doc, Paystack Ghana doc, Neon layout |

---

## Decision

We **stop evolving the current custom Medusa tree as the production backend**.

We **start the marketplace backend afresh** as a single clean engine:

```text
Alkemart backend (new) =
  Medusa Framework (commerce core: products, cart, order, region, payment modules)
+ Mercur marketplace blocks (sellers, commissions, split orders, admin + vendor panels)
+ Alkemart-owned adapters only (Paystack Ghana, regions/currencies policy, RBAC extras)
```

We **do not fork** `mercurjs/mercur`. We **create our own app** via `bun create mercur-app@latest` (or equivalent CLI) into a new path we own.

### What “clear Medusa” means (precise)

| Phrase | Meaning |
|--------|---------|
| Clear **our** Medusa | Archive / freeze `alkemart-medusa/` — custom half-migration, dual-home modules, partial RBAC routes |
| Clear **Medusa the engine** | **No** — Mercur runs **on** Medusa. The framework stays. |
| Clear **Express** | Yes as **runtime** marketplace API. Keep code only as **reference** for port inventory + ETL ideas |

So: **cleaner implementation = new backend project**, not delete commerce forever.

---

## Why

1. **Split brain** — Express + patched Medusa + SPA honesty gates cannot scale admin/vendor gates cleanly.
2. **Half-modules** — customer-roles, store alkemart routes, Ghana payments modules were bolted onto a migrating tree; harder to reason about than a green spine.
3. **Marketplace domain incomplete** — vendor ownership, split orders, commissions belong in a known marketplace layer (Mercur), not reinvented under time pressure.
4. **Countries / currencies / admin** need **Region-first** config and real admin/vendor panels, not more SPA stubs.

---

## Target layout (repo)

```text
Alkemart4/
  apps/
    backend/                 ← Mercur app (Medusa + marketplace). Sole commerce API.
    storefront/              ← Greenfield buyer SPA (port 5175)
  archive/
    alkemart-medusa-legacy/  ← FROZEN custom Medusa (reference only)
    lab-spa-legacy/          ← FROZEN dual-home lab SPA
    express-api-server-legacy/
    express-libs-legacy/
    mockup-sandbox-legacy/
    express-scripts-legacy/
  docs/architecture/         ← ADRs remain binding for money/Ghana rules
  scripts/                   ← neon/backend helpers only (no Express seeds)
```

**2026-07-17:** Express dual-home + lab SPA + `lib/*` moved to `archive/` and removed from root workspaces. See `2026-07-17-dead-project-cleanup.md`.

---

## What we keep (portable knowledge)

| Asset | Action |
|-------|--------|
| Paystack Ghana ADRs, pesewas rules, MoMo async | **Port into new provider** — do not invent money rules again |
| Neon layout / branch policy | **Reuse** — new DB name or branch e.g. `alkemart_marketplace` / `medusa-clean` |
| CASL role names & gate matrix | **Re-apply** on Mercur admin/seller + customer actors |
| Express multi-vendor ops inventory | **Reference** for feature parity checklist |
| SPA UI / brand | **Keep**; point API base at new backend after cutover |
| Seed/ETL ideas from old backend scripts | Cherry-pick only after new schema is stable |

## What we do **not** port line-for-line

- Dual-home `/store/alkemart/*` bolted APIs as the long-term shape (replace with Mercur + clean custom modules)
- Partial `customer-roles` module as-is (rebuild against Mercur seller/admin model)
- Express as concurrent production writer
- Any “stub returns empty success” ops path

---

## Runtime model (after cutover)

```text
                    ┌─────────────────────────────┐
  Buyers (SPA)  ──► │  apps/backend (Medusa+Mercur)│
  Admin panel   ──► │  single write path           │──► Neon Postgres
  Vendor panel  ──► │  Redis (jobs/cache)          │──► Paystack
                    └─────────────────────────────┘

  Express: offline reference only
  archive/alkemart-medusa-legacy: offline reference only
```

**One process family for commerce.** No Express races.

---

## Product requirements baked into the new backend

### Countries & currencies

- Medusa **Regions**: one currency per region; countries assigned to regions.
- v1: **Ghana / GHS** primary.
- Later regions (NGN, KES, USD) only when payment channels + catalog prices exist.
- Region create/edit: **admin-gated** only.
- Storefront resolves market → region → prices + payment providers.

### Admin gates (scalability)

| Actor | Surface | Scope |
|-------|---------|--------|
| Platform super_admin / ops / support / finance | Mercur Admin (+ limited custom UI) | Global rules, vendors, commissions, disputes |
| vendor_owner / vendor_staff | Mercur Vendor panel | Own seller org only |
| buyer | SPA | Self cart/orders |

Row-level seller isolation is mandatory. Audit log for approve vendor, commission change, payout.

### Paystack (full integration research → build)

Not a config toggle — a dedicated workstream on the **new** backend:

1. Payment module provider (hosted checkout preferred for cards + multi-channel).
2. Ghana channels: **card**, **MoMo** (MTN/ATL/Telecel), Apple Pay / bank transfer when account-enabled.
3. Webhooks + verify + idempotent order completion (pesewas).
4. Marketplace settlement: **subaccounts + multi-split** and/or delayed **Transfers** per ADR.
5. Channel allow-list **per region**.
6. Test matrix then live MoMo only with controlled keys.

---

## Phased execution

### Phase 0 — Freeze & archive (this decision)

1. Stop new feature work in `alkemart-medusa/`.
2. `git mv alkemart-medusa archive/alkemart-medusa-legacy` (or equivalent; keep history).
3. Document SPA: backend rebuild in progress; do not expand dual-home.
4. Express remains reference; no new marketplace features there.

### Phase 1 — Scaffold clean engine

1. `bun create mercur-app@latest` → `apps/backend` (name TBD).
2. Neon **new branch or database** (do not mutate production Express data blindly).
3. Redis for local/prod jobs.
4. Seed admin; walk seller register → approve → product → cart.
5. Configure **Ghana region / GHS**.

### Phase 2 — Alkemart adapters only

1. Paystack provider (capture path first).
2. Settlement policy (split vs delayed).
3. Role matrix + admin gates.
4. Optional: port minimal custom modules only when Mercur blocks lack them.

### Phase 3 — SPA cutover

1. Point SPA `VITE_*` at new backend only.
2. Remove Express production path and api-stubs dual-home.
3. Live E2E: auth roles, multi-vendor order, MoMo/card.

### Phase 4 — Decommission

1. Express runtime off.
2. Legacy archive remains for archaeology; no runtime imports.
3. Update DEPLOYMENT.md / fly / Docker to `apps/backend` only.

---

## Explicit non-goals (Phase 0–1)

- Line-by-line migration of every old Medusa route into the new app on day one.
- Keeping Express and new backend both writable.
- Forking upstream Mercur monorepo long-term.
- Multi-country launch before Ghana path is solid.

---

## Success criteria

| Criterion | Evidence |
|-----------|----------|
| Single write path | Only `apps/backend` mutates commerce data |
| Clean tree | No dependency on `archive/alkemart-medusa-legacy` at runtime |
| Regions live | GH/GHS configured; prices in GHS |
| Admin/vendor | Mercur panels usable for approve seller + list product |
| Paystack | At least one full paid path (card or MoMo) with webhook verify |
| SPA | Store browse + checkout against new API without Express |

---

## Implementation checklist

### Phase 0 — Freeze & archive

- [x] Branch `feat/clean-slate-backend`
- [x] `alkemart-medusa` → `archive/alkemart-medusa-legacy`
- [x] Archive README + `ARCHIVED.md`
- [x] Root `.gitignore` updated for archive + `apps/backend`

### Phase 1 — Scaffold clean engine

- [x] Mercur basic template → `apps/backend` (nested monorepo; own `bun.lock`)
- [x] Nested `.git` removed (owned by Alkemart monorepo)
- [x] `packages/api/.env.template` with SPA CORS + Paystack placeholders
- [x] Root script `bun run dev:backend`
- [x] Dedicated Neon DB `alkemart_marketplace` on branch `medusa-prod` (via neonctl)
- [x] `bun run neon:connect` wires pooled/unpooled URLs into `apps/backend/packages/api/.env`
- [x] Redis installed (`redis-cli` PONG); `REDIS_URL=redis://localhost:6379`
- [x] `backend:migrate` completed (Linux worktree `/home/amber/alkemart-backend` — not `/mnt/c`)
- [x] `bun run backend:sync` for WSL → Linux FS (avoid NTFS migrate slowness)
- [ ] `bun run dev:backend:fast` healthy (admin + seller register)
- [ ] Seed Ghana region / GHS in admin

### Phase 2+ — Adapters & cutover

- [ ] Paystack payment provider
- [ ] Settlement policy (split vs delayed)
- [ ] Role matrix gates
- [ ] SPA single API base; Express off write path

Commercial ADRs (money, MoMo, settlements) remain **source of truth** for behavior; only the **code home** changes.
