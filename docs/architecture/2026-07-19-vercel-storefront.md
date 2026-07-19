# Storefront on Vercel (CLI)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Project** | `alkemart-storefront` (team: isaiahamber5-6265s-projects) |
| **Production** | https://alkemart-storefront.vercel.app |
| **What** | Buyer SPA only — **not** Medusa API / Neon |

## What we did **not** install via Vercel Marketplace

- **Neon** — already in use by Medusa (`alkemart_marketplace`). Do not provision a second Neon on Vercel for this shop.
- **Redis / Paystack** — belong on the API host.

## Deploy (CLI)

```bash
cd /home/amber/alkemart-storefront   # or apps/storefront
vercel link --yes --project alkemart-storefront
# env already set for production/development
vercel deploy --prod --yes
```

`vercel.json`: SPA rewrite to `index.html`, `bun install` + `bun run build` → `dist`.

## Env (build-time Vite)

| Variable | Notes |
|----------|--------|
| `VITE_MEDUSA_BACKEND_URL` | Must be **public https** for real users (not localhost) |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | From Admin |
| `VITE_MEDUSA_REGION_ID` | Ghana |
| `VITE_MEDUSA_SALES_CHANNEL_ID` | Store channel |
| `VITE_MERCUR_VENDOR_URL` / `VITE_MERCUR_ADMIN_URL` | Seller / admin links |
| `VITE_PUBLIC_SITE_URL` | `https://alkemart-storefront.vercel.app` |
| `VITE_HOME_DEMO` | `0` for production-clean catalog |

## API CORS (required for live commerce)

When API is public, add Vercel origin:

```text
STORE_CORS=https://alkemart-storefront.vercel.app
AUTH_CORS=https://alkemart-storefront.vercel.app
```

Until then the static shell loads; catalog/cart call `localhost` and fail in visitors’ browsers.

## Redeploy after env change

```bash
vercel env add …   # or dashboard
vercel deploy --prod --yes
```
