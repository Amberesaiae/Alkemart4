# `@workspace/storefront` — greenfield buyer SPA

**Canonical buyer app.** The dual-home lab SPA is archived under `archive/lab-spa-legacy` — do not run it.

| App | Path | Port | Role |
|-----|------|------|------|
| **storefront (use this)** | `apps/storefront` | **5175** | Greenfield buyer only |
| lab (archived) | `archive/lab-spa-legacy` | — | Reference only — do **not** run |
| Mercur API | Linux worktree | **9000** | Commerce engine |
| Mercur seller/admin | same API host | `/seller`, `/dashboard` | Ops UIs |

**Shop URL:** `http://localhost:5175/`  
**API health:** `http://localhost:9000/health` → OK  

WSL on `/mnt/c` often freezes Vite — prefer a Linux-native copy:

```bash
rsync -a --exclude node_modules --exclude dist apps/storefront/ /home/amber/alkemart-storefront/
cd /home/amber/alkemart-storefront && bun install && bun run dev
# → http://localhost:5175/
```

## Rules

- **No hardcodes / no magic** — commerce IDs and keys only from env / Admin / seed output
- **No Express `/api` proxy**
- **No SPA admin/vendor** — external Mercur links only
- Mode B: **COD only**; MoMo shown disabled, not simulated
- **RBAC split** — see `docs/ACCESS-AND-RBAC.md` (buyer guest/customer here; seller/admin in Seller Hub + Admin)
- **Full E2E procedures** — monorepo `docs/architecture/2026-07-17-complete-e2e-architecture-procedures.md`

## Setup

```bash
cp apps/storefront/.env.template apps/storefront/.env
# Fill VITE_MEDUSA_* from running Mercur (publishable key, region, sales channel)
bun install
bun run --filter @workspace/storefront dev
# → http://localhost:5175
```

## Buyer paths

| Path | Notes |
|------|--------|
| `/` | Market + categories + seller chips + load more |
| `/browse/$slug` | PLP (`all` or category handle/id) + load more |
| `/sellers` | Vendor list (API) or sellers derived from product fields |
| `/store/$slug` | Seller storefront |
| `/product/$id` | PDP, qty stepper, sticky ATC, related products |
| `/search?q=` | Store product search |
| `/cart` | Multi-seller groups, qty, sticky checkout |
| `/checkout` | Saved addresses, shipping options preview, COD only |
| `/signin?redirect=` | Login / register + optional safe redirect |
| `/account` | Profile, addresses, set default shipping |
| `/orders` | Account orders + guest find-by-id + recent device ids |
| `/order/$id` | Detail, copy id/link, multi-seller items; `?placed=1` |
| `/help` | FAQ |

## Scripts

```bash
bun run typecheck
bun run build
bun run serve
```
