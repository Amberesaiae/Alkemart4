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
| `DATABASE_URL` | **Runtime** — Neon **pooled** host (`…-pooler…`) for Medusa/Mercur |
| `DATABASE_URL_UNPOOLED` | Migrations / `pg_dump` / session features — **direct** host only |
| `EXPRESS_DATABASE_URL` | Express/ETL source only — never the new Medusa runtime |

Never commit connection strings. Agents without `NEON_API_KEY` must not run interactive `neonctl auth`.

---

## Is keep-warm “best practice”?

**No — it is a free-plan workaround.**

| Approach | When | Neon’s intended model |
|----------|------|------------------------|
| `scripts/neon-keep-warm.sh` | Free plan only, **while actively developing** | Work around forced 5‑minute scale-to-zero |
| **Launch plan + disable scale-to-zero** | Production marketplace | Official: always-on compute ([scale to zero](https://neon.com/docs/introduction/scale-to-zero)) |
| **Scale plan** | SLA, private networking, long suspend config | Full control (1 min → always on) |

Official plan rules ([plans](https://neon.com/docs/introduction/plans)):

| Plan | Scale to zero |
|------|----------------|
| **Free** | After **5 min** idle — **cannot disable** |
| **Launch** | Default 5 min — **can disable** (always on) |
| **Scale** | Configurable 1 min → always on |

Cold start after suspend is typically **hundreds of ms to a few seconds** on Neon’s side; multi-minute hangs we saw are free-tier wake + Ghana ↔ `aws-us-east-1` RTT × many Medusa queries.

---

## Would paid make Neon “super fast”?

**Honest answer: no magic speedup.**

| What paid fixes | What paid does **not** fix |
|-----------------|----------------------------|
| **Cold starts** (disable scale-to-zero on Launch+) | Physics: **Ghana → us-east-1** RTT |
| Higher autoscaling ceiling (Launch up to **16 CU**) | Medusa/Mercur **N sequential queries** still add up |
| More storage, branches, monitoring | App-level N+1 / fat graph loads |
| Production features (history, protected branches, …) | Wrong region for West Africa |

Expect after **Launch + always-on + min CU ~0.5–1**:

- First query after idle: **no multi-minute suspend**
- Warm catalog: still often **1–4 s** from Accra to US East (we measured ~3 s warm on free with min CU raised)
- Same stack in **EU** (or API co-located with DB): larger feel improvement than CU alone

**Paid = reliability + no sleep tax**, not “local Postgres latency.”

---

## Recommended compute profiles

### Free (current org: `free_v3`) — active dev only

Endpoint: `ep-restless-lab-at072v3y` · branch **medusa-prod** · DB `alkemart_marketplace`

| Setting | Recommended | Why |
|---------|-------------|-----|
| Min CU | **0.5** | Better headroom than 0.25; free plan only has **100 CU-hours/project/month** |
| Max CU | **2** | Free autoscaling cap |
| Suspend | Plan default (5 min) | Cannot change |
| Keep-warm | **Only while coding** | Continuous min=1 + always warm can burn the free CU budget in days |

```bash
# one-shot wake
bash scripts/neon-keep-warm.sh

# loop every 4 min during a work session (stop when done)
bash scripts/neon-keep-warm.sh --loop
```

CU-hour math (Free includes **100 CU-hours/month**):

- `0.25 CU × 400 h ≈ 100`  
- `0.5 CU × 200 h ≈ 100`  
- `1 CU × 100 h ≈ 100` (≈ **4 days** always-on)

### Launch (production target for Alkemart)

Do this in Console or API after upgrade:

1. **Disable scale-to-zero** on medusa-prod compute  
2. Min CU **0.5 or 1**, max **2** (raise max if Monitoring shows CPU/RAM pressure)  
3. Keep **pooled** `DATABASE_URL` for API; direct for migrations  
4. Stop relying on `neon-keep-warm.sh` for prod  

Rough always-on cost (Launch **$0.106/CU-hour**):  
`1 CU × 24 × 30 ≈ 720 CU-hours ≈ $76/mo` compute only — size min CU down if traffic is light.

### Connection best practice (already aligned)

Per [connection pooling](https://neon.com/docs/connect/connection-pooling):

| Workload | URL |
|----------|-----|
| Medusa long-running Node API | **Pooled** (`-pooler`) ✅ current `.env` |
| `medusa db:migrate`, dumps | **Direct** (`DATABASE_URL_UNPOOLED`) ✅ |
| Transaction pooler caveats | No session `SET` / LISTEN — fine for Medusa runtime |

Do **not** use Neon Auth for buyer/seller — Medusa/Mercur own the three doors.

---

## CLI quick reference (this project)

```bash
PROJECT=wispy-union-10280789
EP=ep-restless-lab-at072v3y   # medusa-prod

# Start compute
neonctl api "/projects/$PROJECT/endpoints/$EP/start" -X POST

# Autoscaling only (free cannot set suspend)
neonctl api "/projects/$PROJECT/endpoints/$EP" -X PATCH -d '{
  "endpoint": {
    "autoscaling_limit_min_cu": 0.5,
    "autoscaling_limit_max_cu": 2
  }
}'

# Inspect
neonctl api "/projects/$PROJECT/endpoints/$EP"
neonctl branches get medusa-prod --project-id $PROJECT -o json
```

Suspend disable (fails on Free — expected):

```bash
neonctl api "/projects/$PROJECT/endpoints/$EP" -X PATCH -d '{
  "endpoint": { "suspend_timeout_seconds": -1 }
}'
# → "modifying the suspend interval is not permitted on this account"
```

---

## Branch-first (Neon skill default)

Workspace has `.neon` linked. Prefer:

```bash
neonctl checkout medusa-prod          # pin branch + env pull when interactive
neonctl branches list --project-id wispy-union-10280789
```

Feature work: optional child branches for schema experiments; **production money path stays on medusa-prod**. Delete unused child branches (storage + free branch limits).

---

## What still dominates latency for Ghana

1. **Region** `aws-us-east-1` (Virginia) vs clients in Accra  
2. **Query chatty-ness** of Medusa/Mercur (many round-trips per request)  
3. **Cold compute** on Free (fixed 5 min scale-to-zero)

Improvements ranked for this product:

| Rank | Change | Impact |
|------|--------|--------|
| 1 | Launch + disable scale-to-zero | Removes multi-minute freezes |
| 2 | (Later) closer region / co-locate API with DB | Cuts base RTT |
| 3 | Catalog/cache, leaner store fields | Fewer RTTs |
| 4 | Higher max CU only if Monitoring shows pressure | Throughput, not RTT |

---

## Current applied settings (2026-07-19)

| Item | Value |
|------|--------|
| Project | `wispy-union-10280789` (Alkemart) |
| Region | `aws-us-east-1` (no region move unless requested) |
| Branch | `medusa-prod` |
| Endpoint | `ep-restless-lab-at072v3y` |
| Plan | **free_v3** |
| Min / max CU | **0.5 / 2** |
| Suspend | plan default (cannot disable) |
| Runtime URL | pooled ✅ |
| Keep-warm script | `scripts/neon-keep-warm.sh` (dev workaround) |

## Performance (cross-link)

Full P0/P1/P2 checklist, catalog query notes, and marketplace practices:

→ **[docs/architecture/2026-07-19-performance-practices.md](./architecture/2026-07-19-performance-practices.md)**
