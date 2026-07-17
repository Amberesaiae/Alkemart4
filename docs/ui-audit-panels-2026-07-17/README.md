# Panel UI audit — Admin & Seller Hub (2026-07-17)

## Status (complete for lab)

| Surface | Login | Branding | Analytics | Notes |
|---------|-------|----------|-----------|-------|
| **Admin** | ✅ | ✅ alkemart wordmark + logo | ✅ KPIs/charts | No Medusa/Mercur chrome |
| **Seller Hub** | ✅ | ✅ | ✅ route loads | Store **Alkemart Lab Shop** active |

## Lab credentials

| Surface | URL | Email | Password |
|---------|-----|-------|----------|
| Admin | http://localhost:7000/dashboard | `admin@alkemart.local` | `supersecret` |
| Seller | http://localhost:7001/seller | `seller@alkemart.local` | `supersecret` |

Use **`localhost`**, not `127.0.0.1`, so auth cookies match the API.

### Seller first-time / repair

If Seller Hub lands on empty store-select or `actor_id` is empty:

```bash
cd /home/amber/alkemart-backend/packages/api   # or apps/backend/packages/api
bunx medusa exec ./src/scripts/ensure-lab-seller.ts
```

Creates/approves **Alkemart Lab Shop** for `seller@alkemart.local`. Then sign in and click the store card (not “Add new store”).

## Fixes applied

| Issue | Fix |
|-------|-----|
| Login logo broken (404 absolute path) | `logo: '/dashboard/logo.svg'` / `'/seller/logo.svg'` + geometric mark SVG |
| Monotonous “Welcome to alkemart” ×3 | i18n: title **Welcome back**, role under wordmark, distinct hints |
| API down / login fail | Restart Medusa; Neon cold-start can hang pool — health on `:9000` |
| “Medusa Store” platform name | Renamed to **alkemart** via admin API; seed now writes `alkemart` |
| Seller incomplete (`actor_id` empty) | `ensure-lab-seller.ts` + seed email `seller@alkemart.local` |
| “Welcome to Mercur” | `mercurDashboardPlugin({ name: "alkemart" })` + i18n |
| Session 401 cookies | `VITE_MERCUR_BACKEND_URL=http://localhost:9000` |
| Shell “Medusa Store” / **M** | Global `brand-patch.ts` scrubber |

## Screenshots

- Admin: `e2e-admin-login.png`, `e2e-admin-after.png`, `e2e-admin-analytics.png`
- Seller: `seller-store-select-ready.png`, `seller-after-store-select.png`, `seller-ok-*.png`

## Run locally

```bash
# Redis
redis-server --daemonize yes

# API :9000
cd apps/backend/packages/api && bun run dev

# Panels
cd apps/backend/apps/admin && bun run dev    # :7000/dashboard
cd apps/backend/apps/vendor && bun run dev   # :7001/seller
```

## Known residual (cosmetic)

- Sidebar monogram letter (**A** / **L**) comes from Mercur avatar chip; store name shows **Alkemart Lab Shop**.
- “Almost ready to sell” banner is intentional setup copy on seller pages until catalog is fully stocked.
