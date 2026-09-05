# URL & navigation matrix (all actors)

| Date | 2026-07-19 |
|------|------------|

## GitHub (status)

| Item | Reality |
|------|---------|
| Remote | `https://github.com/Amberesaiae/Alkemart4.git` |
| Branch worked | `feat/clean-slate-backend` (not `main`) |
| vs `origin/feat/...` | Ahead **11 commits** (not fully pushed) + large **uncommitted** tree |
| `main` | Old tip; **not** the production marketplace tip |
| Storefront on Vercel | Built from local CLI deploy, **not** necessarily GitHub main |

**Not pushed as `main`.** To ship Git: commit remaining work → push branch → open PR → merge to `main` when ready.

## Backend “not running”

| Surface | Local now | Public (Vercel shop) |
|---------|-----------|----------------------|
| API `/health` | **200** on `:9000` | Shop points at `localhost:9000` → **fails for visitors** |
| Seller Hub | `:9000/seller` or `:7001` | Needs public API host |
| Admin | `:9000/dashboard` or `:7000` | **Own secured URL**, not on shop |

Fix: deploy Medusa to a public HTTPS host and set `VITE_MEDUSA_BACKEND_URL` + CORS.

## Buyer shop URLs (professional)

| Role | Path | Notes |
|------|------|--------|
| Home | `/` | Market home |
| Categories | **`/categories/:slug`** | was `/browse/:slug` (legacy redirects) |
| Product | `/product/:id` | Prefer handle when linking |
| Shops list | **`/shops`** | was `/sellers` |
| Shop page | **`/shops/:slug`** | was `/store/:slug` |
| Search | `/search` | |
| Cart | `/cart` | noindex |
| Checkout | `/checkout` | noindex |
| Login | **`/login`** | was `/signin` (legacy redirects) |
| Account | `/account` | noindex |
| Orders | `/orders`, `/order/:id` | labels = `Order #n` / masked ref |
| Sell | `/sell` | Seller entry |
| Help | `/help` | |
| Partners | `/partners` | prod → redirect `/sell` |

Legacy paths **redirect** so old bookmarks still work.

## Seller Hub

| | |
|--|--|
| URL | `{API}/seller` or dedicated seller host |
| Nav | Orders, Products, Offers, Inventory, Customers, Categories |
| Auth | Member + store select — separate from shopper |

## Admin (ops only)

| | |
|--|--|
| URL | `{API}/dashboard` — **bookmark privately** |
| Nav | Orders, Products, Offers, Customers, Inventory, Sellers, Categories |
| Not linked | From Vercel shop footer/help/partners |

## Auth separation (critical)

| Actor | Login surface |
|-------|----------------|
| Buyer | Shop `/login` |
| Seller | Seller Hub only |
| Admin | Admin dashboard only |
