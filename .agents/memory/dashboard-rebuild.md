---
name: Dashboard Rebuild
description: Brand new vendor + admin dashboards built from scratch, replacing ghana-vendor and admin apps
---

## What Was Built

Two full dashboard SPAs replacing the existing @mercurjs/admin SDK-based admin and the ghana-vendor app.

- **Vendor Dashboard** — `Alkemart4/apps/backend/apps/ghana-vendor/` — port 3002, base `/seller/`
- **Admin Dashboard** — `Alkemart4/apps/backend/apps/admin/` — port 3001, base `/dashboard/`

Both use Montserrat font, `--primary: #febf31` gold, `#1a1a1a` dark ink sidebar, storefront design tokens.

## Key Decisions

**Why:** User wanted brand new dashboards (not API fixes), replacing existing apps, using storefront foundational design.

**Vendor stack:** React + TanStack Router (file-based) + TanStack Query + Tailwind v4. Installs via `bun install` from app dir.

**Admin stack:** Completely replaced `@mercurjs/admin` SDK with custom React + TanStack Router SPA. Same stack as vendor. Admin's package.json was fully rewritten (removed @mercurjs/* deps).

**Workflows:** `Vendor Dashboard` and `Admin Dashboard` — configured with `configureWorkflow`, not artifact-managed.

## How to Apply

- Both apps need `bun install` run from their own directories (not inherited from workspace root).
- Both vite configs must have `server.host: true` — otherwise Replit proxy can't reach them.
- Ports 3001 and 3002 are both in the supported workflow port list.
- Admin dev script: `"dev": "vite --port 3001"` in package.json (the CLI flag overrides vite.config server.port).

## Pitfalls Fixed

- `stats.dashboard()` does not exist in api.ts — correct call is `stats.get()`
- Orders route is nested at `routes/orders/index.tsx` — imports need `../../lib/hooks` not `../lib/hooks`
- TanStack Router `to` prop does not accept template literals — use `to="/orders/$id" params={{ id }}` syntax
- Badge `variant="primary"` doesn't exist in ui.tsx — use `"default"` for neutral/shipped state
- Case sensitivity: design subagent created `Layout.tsx` (uppercase) conflicting with existing `layout.tsx` — delete the uppercase one
- `@alkemart/shared` is NOT available in the vendor app — use local `cn` from `./ui`
- `auth.getSession` must be defined in admin `src/lib/api.ts` for the `_authenticated` route guard
