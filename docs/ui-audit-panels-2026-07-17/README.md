# Panel UI audit — Admin & Seller Hub (2026-07-17)

## Fixes applied this session

| Issue | Fix |
|-------|-----|
| “Welcome to Mercur” | `mercurDashboardPlugin({ name: "alkemart" })` + i18n `login.title` |
| Login `Failed to fetch` / session 401 | `VITE_MERCUR_BACKEND_URL=http://localhost:9000` (same host as browser; not `127.0.0.1`) + CORS for both hosts |
| “Medusa Store” / monogram **M** in shell | Global `brand-patch.ts` scrubber on every page |
| Analytics empty KPIs | Stats fetch uses absolute `__BACKEND_URL__/admin/alkemart/stats` |
| Banner wrong path | `panelHref("analytics")` respects `/dashboard` or `/seller` base |
| Reusable UI | `components/ui.tsx` — AlkPage, AlkKpi, AlkBanner, AlkChartCard |

## Lab credentials

| Surface | Email | Password |
|---------|-------|----------|
| Admin | `admin@alkemart.local` | `supersecret` |
| Seller (new lab) | `seller@alkemart.local` | `supersecret` |

> `seller@mercur.dev` may be out of sync if seed skipped re-register; use the alkemart.local seller or re-seed.

## Screenshots

See `verify-*.png`, `final-admin-*.png`, `seller-ok-*.png` in this folder.

## Verify locally

```bash
# API must be on localhost:9000
# Panels:
cd apps/backend/apps/admin && bun run dev   # :7000/dashboard
cd apps/backend/apps/vendor && bun run dev  # :7001/seller
```

Open with **http://localhost:…** (not 127.0.0.1) so cookies match.
