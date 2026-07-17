# Alkemart backend (clean slate)

**Sole commerce / marketplace API** for Alkemart.

Built with:

- [Medusa](https://medusajs.com) — products, cart, orders, **regions/currencies**, payments modules
- [Mercur](https://docs.mercurjs.com) — multi-vendor marketplace (sellers, admin + vendor panels, commissions)

This is **not** the archived tree under `archive/alkemart-medusa-legacy/`.

ADR: `docs/architecture/2026-07-16-clean-slate-backend.md`  

**E2E handbook (all procedures):** `docs/architecture/2026-07-17-complete-e2e-architecture-procedures.md`

## Layout

```text
apps/backend/
  packages/api/     Medusa + Mercur API (port 9000)
  apps/admin/       Platform admin UI → /dashboard
  apps/vendor/      Seller UI → /seller
  blocks.json       Mercur block registry config
```

## Prerequisites

- Node ≥ 20, Bun ≥ 1.3
- PostgreSQL (Neon branch/database dedicated to this backend)
- Redis (`REDIS_URL`)

## Setup

```bash
# From monorepo root — Neon CLI wires DATABASE_URL (pooled) for alkemart_marketplace
bun run neon:connect

# WSL: sync to Linux FS worktree (ext4) — required for fast migrate/dev
# Target: /home/amber/alkemart-backend  (running from /mnt/c is very slow)
bun run backend:sync

# Schema (uses Linux worktree when present; single pass, skips done modules)
bun run backend:migrate

# API + admin/vendor panels
# Prefer fast path on WSL:
bun run dev:backend:fast
# or monorepo path (slower on /mnt/c):
bun run dev:backend
```

Manual env (only if not using CLI):

```bash
cd apps/backend
cp packages/api/.env.template packages/api/.env
# Set DATABASE_URL to Neon pooled URL for database alkemart_marketplace
bun install
bun dev
```

| Surface | URL |
|---------|-----|
| API | http://localhost:9000 |
| Admin | http://localhost:9000/dashboard |
| Vendor | http://localhost:9000/seller |
| Seller register | http://localhost:9000/seller/register |

### First admin (required — you cannot self-signup in the dashboard)

Admin is a **user** actor. The dashboard login only accepts existing users.

```bash
cd packages/api   # or /home/amber/alkemart-backend/packages/api on WSL
bunx medusa user -e admin@example.com -p 'ChooseAStrongPass'
```

Then open **http://localhost:9000/dashboard** and sign in with that email/password.

**Lab note:** this environment already has a super-admin  
`admin@alkemart.local` / `supersecret` (verified against live API). Prefer changing
that password for anything beyond local lab use.

### Seller

1. Register at **http://localhost:9000/seller/register** (creates a **member**)
2. Create seller/store in the vendor panel (often `pending_approval`)
3. In **Admin**, approve the seller
4. In **Seller hub**, add stock, products, shipping, offers

Plain-English guide: `docs/architecture/2026-07-17-mercur-admin-seller-explained.md`  
Vendor API runbook: `docs/architecture/2026-07-16-mercur-vendor-rbac-catalog-runbook.md`

Buyer shop: **http://localhost:5175** (customer accounts only — not admin/seller).

## Regions (Ghana first)

Configure in Admin (Medusa settings):

1. Region **Ghana**, currency **GHS**, country **GH**
2. Attach payment / fulfillment providers when ready
3. Price products in GHS

Do not invent parallel country tables in Express.

## Vendor catalog (RBAC — no seed inject)

See `docs/architecture/2026-07-16-mercur-vendor-rbac-catalog-runbook.md`.

Short path:

1. Auth as **member** (`/auth/member/emailpass`) — not `seller`
2. `POST /vendor/sellers` → admin `…/approve`
3. Vendor product `status: proposed` → admin `…/confirm`
4. Stock location + shipping profile + **offer** (GHS price)
5. Link product to sales channel + `product_seller` (admin products/:id/sellers)
6. Store cart uses **`offer_id`**, not `variant_id`

UI: http://localhost:9000/seller (member login)

## What belongs here next (Alkemart only)

1. ~~Paystack payment provider~~ (module ported; set `PAYSTACK_SECRET_KEY` to register)
2. Enable Paystack on Ghana region + SPA payment collection
3. Marketplace settlement (subaccounts / multi-split) per commercial spine ADR
4. Admin RBAC extras (support/finance gates) if Mercur defaults are too coarse

## What does **not** belong here

- Runtime imports from `archive/alkemart-medusa-legacy`
- Express as a second write path
- Dual-home stubs

## Mercur CLI

```bash
cd apps/backend
bunx @mercurjs/cli@latest search
bunx @mercurjs/cli@latest add <block>
```

Docs: https://docs.mercurjs.com

## Telemetry

Optional:

```bash
export MERCUR_DISABLE_TELEMETRY=true
```
