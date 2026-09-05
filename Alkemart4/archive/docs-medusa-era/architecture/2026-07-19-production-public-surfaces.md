# Production public surfaces (buyer shop)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Shop** | https://alkemart-storefront.vercel.app |

## Buyer shop (public)

| Allowed | Not on shop chrome |
|---------|-------------------|
| Browse, search, cart, checkout, COD | **Admin** link or URL |
| Account, orders, help | `/partners` ops map (redirects to `/sell` in prod) |
| Sellers directory, store pages | Lab-only Admin cards |
| **Sell on alkemart** (`/sell`) + Seller Hub | `VITE_MERCUR_ADMIN_URL` in client env |

## Admin — own secured link

| | |
|--|--|
| **URL** | API host admin, e.g. `https://<api-host>/dashboard` (or your dedicated ops domain) |
| **Auth** | Medusa **user** emailpass — invitation/CLI only, no public signup |
| **Shop** | Never linked from footer, help, partners, or env-driven chrome in production |

Ops bookmark the admin URL. Do **not** set `VITE_MERCUR_ADMIN_URL` on public Vercel production.

## Feature flags (shop)

| Flag | Production |
|------|------------|
| `VITE_SHOW_ADMIN_LINK` | `0` / unset (default off in prod) |
| `VITE_SHOW_OPS_PARTNERS` | `0` / unset → `/partners` → `/sell` |
| `VITE_FEATURE_MOMO_LAB` | off unless MoMo is ready |
| `VITE_HOME_DEMO` | `0` |

## Lab only

Local/dev may show Admin when `VITE_SHOW_ADMIN_LINK` is not forced off (dev default allows lab chrome if env is set).
