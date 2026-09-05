# Agent playbook — distinct implementation approach

**Audience:** coding agents implementing Alkemart features.  
**Stack of record:** Cloudflare Workers API + Hyperdrive + Supabase Postgres + Paystack + three gold Pages UIs (`#FEBF31`).

If a document conflicts with this playbook or `docs/architecture/workers/*`, **this tree wins**. Ignore `archive/**`.

---

## 1. What you may touch

| Area | Path |
|------|------|
| API | `apps/api` |
| Domain / money rules | `packages/domain`, `packages/paystack`, `packages/shared` |
| Schema | `packages/db` |
| Storefront | `apps/storefront` |
| Vendor UI | `apps/backend/apps/ghana-vendor` |
| Admin UI | `apps/backend/apps/admin` |
| Shared UI | `packages/ui` |
| Canonical docs | `docs/architecture/workers/`, `docs/ops/`, `DEPLOYMENT.md`, `AGENTS.md`, `README.md` |

## 2. What you must not use as a write path

| Forbidden | Why |
|-----------|-----|
| `apps/backend/packages/api` (Medusa/Mercur) | Archived runtime candidate — dual writer |
| `archive/**` | Historical only |
| Medusa env (`VITE_MEDUSA_*`), port `:9000` | Dead path |
| Railway / Neon / Mercur deploy docs | Obsolete |
| Inventing returns/address book/wishlist APIs “for completeness” | Not in Workers SoR until scoped |

## 3. Distinct approach (how to implement)

### Step A — Classify the change

Pick **exactly one** lifecycle owner and update that doc if behavior changes:

1. Buyer → `LIFECYCLE-BUYER.md`  
2. Vendor → `LIFECYCLE-VENDOR.md`  
3. Admin → `LIFECYCLE-ADMIN.md`  
4. Payment/stock → `LIFECYCLE-PAYMENT.md` + `ACID-DATAFLOW.md`  

Cross-cutting UI chrome → `NAV-MATRIX.md` + `ENGINEERING-STANDARDS.md`.

### Step B — Backend first

1. Domain rule in `packages/domain` (pesewas, transitions, quotes).  
2. DB schema / migration in `packages/db` if needed.  
3. Repository + Hono route under `apps/api/src/routes/{store,vendor,admin}`.  
4. Money/stock ops must be **transactional** and **idempotent** where webhooks/polls can retry.  
5. Vitest next to the route when logic is non-trivial.

### Step C — Frontend second

1. Call Workers via `VITE_ALKEMART_API_URL` (absolute URL). No Medusa SDK.  
2. Hide nav for capabilities the API does not serve.  
3. Empty/error honesty — never fake success for missing Workers features.  
4. Keep brand gold `#FEBF31`.

### Step D — Verify

1. Local: `bun run dev:workers` (see `LOCAL-DEV.md`).  
2. API: `./scripts/e2e-workers-smoke.sh` and/or `./scripts/e2e-workers-acid.sh` (point `ALKEMART_API_URL` at local if needed).  
3. Manual click path from `NAV-MATRIX.md` for the routes you touched.  
4. Do **not** push unless the human asks. Stay on `main`.

## 4. Non-negotiable invariants

1. **Single writer** — Workers only.  
2. **ATC = `offerId`** — Product ≠ Offer.  
3. **Pesewas integers** — no float ledger amounts.  
4. **OrderGroup** — multi-seller checkout splits into per-seller orders.  
5. **MoMo/card** — reserve stock while pending; release on fail; confirm idempotent.  
6. **Docs = code** — update the matching lifecycle file in the same change.

## 5. Reading order for a new agent session

1. This file  
2. `LOCAL-DEV.md`  
3. `ACID-DATAFLOW.md`  
4. The one lifecycle file for your task  
5. `docs/ops/LAUNCH-GATE-STATUS.md` (honesty about gaps)  
6. Optional design reference: `docs/superpowers/specs/2026-09-01-cloudflare-e2e-architecture.md`

## 6. Feature template (copy into PR / commit body)

```
Lifecycle: buyer | vendor | admin | payment
API: METHOD /path
DB tables touched:
UI routes / clicks:
ACID notes (tx / idempotency / stock):
Gaps deferred:
Verify: local | smoke | acid | manual nav
```
