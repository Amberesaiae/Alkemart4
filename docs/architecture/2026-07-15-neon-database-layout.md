# Neon database layout — Alkemart Medusa + Express

| Field | Value |
|---|---|
| **Date** | 2026-07-15 |
| **Status** | Canonical ops contract (ADR-P1) |
| **Plan** | `docs/superpowers/plans/2026-07-15-alkemart-neon-medusa-paystack-production-plan.md` |

---

## 1. Today (transitional)

Express (Drizzle) and Medusa currently share the **same Neon host and database** (`neondb` on the project host, e.g. `ep-polished-scene-…`).

This is acceptable **only** for migration engineering:

- Table namespaces largely differ (Drizzle snake plural vs Medusa module tables), but collisions and MikroORM migrations thrashing Express tables remain a risk.
- Both apps must never be treated as long-term co-tenants of one production schema.

**Treat shared `neondb` as transitional — not the production target.**

---

## 2. Target (ADR-P1)

| Consumer | Neon object | Purpose |
|---|---|---|
| **Medusa runtime** | Dedicated branch and/or database **`alkemart_medusa`** | Medusa core + marketplace + payments-ghana tables only |
| **Express (until cutover)** | Current `neondb` (or existing Express branch) | Source of truth for catalog/orders during ETL |
| **ETL** | Reads Express URL → writes Medusa URL | One-way migrate; freeze Express writes at cutover |

**ADR-P1:** Production Medusa gets its **own Neon database** (or branch with isolated DB) named `alkemart_medusa`. Express stays on the current database until cutover is complete. ETL reads Express Neon and writes Medusa Neon. This avoids MikroORM migrations thrashing Express tables.

### Environment mapping (recommended)

| Environment | Neon object | Purpose |
|---|---|---|
| Dev | Branch `dev` or shared project | Medusa + optional Express side-by-side |
| Staging | Branch `staging` | Migration dry-run + Paystack **test** keys |
| Production | Branch `main` / prod project | Medusa only after cutover |

---

## 3. Environment variable contract

| Variable | Owner | Role |
|---|---|---|
| **`DATABASE_URL`** | Medusa backend | **Medusa’s** Neon connection string at runtime. Prefer Neon **pooled** host (`-pooler` in hostname) for the Medusa app. |
| **`EXPRESS_DATABASE_URL`** | ETL scripts only | Express Drizzle source DB for `migrate-from-express`. **Never** used by Medusa runtime (store/admin/workers). |
| `REDIS_URL` | Medusa | Cache / workers |
| Paystack keys | Medusa + SPA | Ghana MoMo; see plan §3 |

### Examples (placeholders only — never commit real strings)

```bash
# Medusa runtime — pooled connection to dedicated Medusa DB/branch
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/alkemart_medusa?sslmode=require

# ETL only — Express source (may still be neondb until cutover)
EXPRESS_DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

### Why pooled for Medusa

Neon serverless Postgres benefits from the **connection pooler** (`-pooler` hostname) under concurrent Medusa request load. Use the direct (non-pooler) host only when a tool requires session-mode features and documents that requirement.

---

## 4. Creating a Medusa branch when authenticated

`NEON_API_KEY` is often unset in agent environments. Do **not** run interactive `neonctl auth` from unattended agents. When a human is authenticated (browser login or API key):

```bash
# Authenticate once (interactive) OR export a project API key
npx neonctl@latest auth
# export NEON_API_KEY=napi_...

npx neonctl@latest projects list

# Create an isolated branch for Medusa (name is an example)
npx neonctl@latest branches create --name medusa-prod --project-id <id>

# Prefer pooled connection string for Medusa runtime
npx neonctl@latest connection-string medusa-prod --project-id <id> --pooled
```

Optional: create a database named `alkemart_medusa` on that branch if the branch still defaults to `neondb`, then point `DATABASE_URL` at that database name.

Copy the resulting URL into:

- `alkemart-medusa/apps/backend/.env` → `DATABASE_URL`
- Host secrets (Fly/etc.) for production/staging

Keep Express on its existing URL until ETL + cutover complete; set `EXPRESS_DATABASE_URL` only on machines that run migration scripts.

---

## 5. Security

- **Never commit** connection strings, `NEON_API_KEY`, or Paystack secrets.
- Commit only `.env.template` with empty placeholders.
- Rotate any URL that was pasted into chat, tickets, or CI logs.
- Production boot already refuses default JWT/cookie secrets; keep `DATABASE_URL` out of SPA env entirely.

---

## 6. Related docs

- Production plan: `docs/superpowers/plans/2026-07-15-alkemart-neon-medusa-paystack-production-plan.md` §2.1, §3.9, §4
- Short pointer: `docs/NEON.md`
- Env template: `alkemart-medusa/apps/backend/.env.template`
- Commerce bootstrap (no catalog): `npx medusa exec ./src/scripts/bootstrap-commerce-context.ts`


---

## 5. Live project wiring (2026-07-15)

| Resource | Value |
|---|---|
| Org | `org-broad-mouse-77761956` |
| Project | **Alkemart** `wispy-union-10280789` (aws-us-east-1) |
| Express / default branch | `production` (`br-lucky-poetry-atb8ihl2`) DB `neondb` |
| Medusa branch | `medusa-prod` (`br-solitary-surf-atbn0web`) |
| Medusa database | **`alkemart_medusa`** (empty schema target) |
| Env | `DATABASE_URL` → medusa-prod / alkemart_medusa (pooled) |
| Env | `EXPRESS_DATABASE_URL` → production / neondb (pooled) |
| Env | `DATABASE_URL_DIRECT` → medusa-prod direct (for migrations when pooler misbehaves) |

### Ops commands

```bash
# Re-fetch pooled URLs after auth
neonctl connection-string medusa-prod --project-id wispy-union-10280789 --database-name alkemart_medusa --pooled
neonctl connection-string production --project-id wispy-union-10280789 --database-name neondb --pooled

# Complete migrations when Neon is reachable from your network
cd alkemart-medusa/apps/backend   # or /home/amber/... runtime
export DATABASE_URL="$DATABASE_URL_DIRECT"   # session mode often better for MikroORM migrate
npx medusa db:migrate
npx medusa exec ./src/scripts/bootstrap-commerce-context.ts
npx medusa exec ./src/scripts/migrate-from-express/run-all.ts
```

### Known friction (WSL)

Medusa `db:migrate` from WSL may hit intermittent `ETIMEDOUT` / IPv6 `ENETUNREACH` to Neon. Prefer:

1. Pooled URL for app runtime  
2. Direct URL + retries for migrations  
3. Or run migrate from a network with stable Neon access  

As of wiring day: core modules partially migrated on `alkemart_medusa` (~113 tables when last checked); `store` may still need a successful migrate pass; `vendor` tables applied via SQL if marketplace migration flaked; `payment_intent` present.
