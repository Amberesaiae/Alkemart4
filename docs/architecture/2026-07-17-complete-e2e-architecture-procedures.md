# Complete E2E architecture & procedures — Alkemart

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Status** | **Operating handbook** — single place for “what we run, who does what, how to prove E2E” |
| **Product brand (UI)** | **alkemart** only — no Mercur/Medusa in customer-facing copy |
| **Engine (internal)** | Medusa commerce + Mercur marketplace (do not market these names) |

This document answers: **What is the full architecture, and what procedures do we need for a complete end-to-end marketplace?**

Related deep dives (do not duplicate here):

| Topic | Doc |
|-------|-----|
| No hardcodes / no magic | `2026-07-16-no-hardcodes-no-magic.md` |
| Clean-slate backend ADR | `2026-07-16-clean-slate-backend.md` |
| Seller API curl runbook | `2026-07-16-mercur-vendor-rbac-catalog-runbook.md` |
| Admin vs seller plain English | `2026-07-17-mercur-admin-seller-explained.md` |
| Ops surfaces plan | `2026-07-16-ops-rbac-surfaces.md` |
| Panel branding | `2026-07-17-alkemart-panel-branding.md` |
| Buyer access | `apps/storefront/docs/ACCESS-AND-RBAC.md` |
| Historical gap map | `2026-07-16-e2e-architecture-gap-map.md` |
| Mode B COD freeze | `2026-07-16-mode-b-lab-demo-freeze.md` |
| MoMo / Paystack | `2026-07-15-paystack-ghana-integration.md` |
| Commercial spine (money) | `2026-07-13-alkemart-architecture-and-commercial-spine.md` |
| Search, facets, analytics, SEO, Ghana adapters | `2026-07-17-data-search-seo-ghana-adaptation-plan.md` |

---

## 1. Target architecture (locked)

```text
┌─────────────────────────────┐
│  BUYER WEBSITE              │  apps/storefront
│  alkemart shop              │  http://localhost:5175
│  Browse · cart · COD        │
│  Customer account · orders  │
│  /sell  →  Seller Hub link  │
└──────────────┬──────────────┘
               │  Store API only (publishable key + optional customer JWT)
               ▼
┌─────────────────────────────┐
│  PLATFORM API               │  apps/backend/packages/api
│  http://localhost:9000      │  (Linux worktree: /home/amber/alkemart-backend)
│  Neon: alkemart_marketplace │
│  Redis (workers / events)   │
└──────┬──────────────┬───────┘
       │              │
       ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ SELLER HUB   │  │ ADMIN            │
│ /seller      │  │ /dashboard       │
│ apps/…/vendor│  │ apps/…/admin     │
│ Upload goods │  │ Approve · config │
│ Fulfill      │  │ Ops              │
└──────────────┘  └──────────────────┘
```

| Actor | UI (product name) | Auth | Writes |
|-------|-------------------|------|--------|
| **Shopper** | Buyer website | Customer (emailpass) or guest | Store cart, COD checkout, customer addresses/orders |
| **Seller** | Seller Hub | Member (emailpass) + seller membership | Vendor products, stock, shipping, offers, fulfill |
| **Platform operator** | Admin | User (emailpass) — **not** self-signup | Approve sellers, products, regions, channels, rules |

**Industry pattern:** same as Jumia / Amazon 3P — customers on the shop, merchants in a seller center, you in admin. Not the same as pure classifieds (Jiji/Tonaton chat-only), but sellers still **self-post catalog** via Seller Hub.

---

## 2. Repository map

| Path | Role |
|------|------|
| `apps/storefront` | **Canonical buyer SPA** (greenfield). Dev: `:5175`. Prefer Linux copy `/home/amber/alkemart-storefront` on WSL. |
| `apps/backend` | **Canonical API + panel sources** (git). |
| `/home/amber/alkemart-backend` | **Runtime worktree** (fast on WSL). Keep synced from `apps/backend`. |
| `archive/lab-spa-legacy` | **Archived** dual-home lab SPA — do not run with greenfield. |
| `archive/express-api-server-legacy` | Express **archived** — not production marketplace API. |
| `archive/*` | Frozen legacy. |

---

## 3. Binding product rules

1. **No hardcodes / no magic** — commerce IDs, keys, prices, offer ids from **env or API** only. Fail loud if missing.  
2. **One buyer URL** — storefront only for shopping.  
3. **No SPA admin/seller dashboards** — those are Seller Hub + Admin (branded alkemart).  
4. **UI never markets engine names** — no “Mercur” / “Medusa” in titles, login, or shopper copy.  
5. **Mode B (lab)** — honest **COD**; MoMo/Paystack charge-before-commit is separate spine work.  
6. **Dual worktree** — edit git source; run migrate/dev on Linux worktree; sync often.

---

## 4. Local URLs (lab)

| Surface | URL |
|---------|-----|
| Buyer shop | http://localhost:5175 |
| Sell entry | http://localhost:5175/sell |
| Partners / ops map | http://localhost:5175/partners |
| API health | http://localhost:9000/health → `OK` |
| Seller Hub | http://localhost:9000/seller |
| Seller register | http://localhost:9000/seller/register |
| Admin | http://localhost:9000/dashboard |

**Health check (all green):**

```bash
curl -s http://localhost:9000/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5175/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000/seller/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000/dashboard/
```

---

## 5. Lab credentials (this environment only)

| Role | Login URL | Email | Password | Notes |
|------|-----------|-------|----------|--------|
| **Admin** | `/dashboard` | `admin@alkemart.local` | `supersecret` | Super-admin; **change outside pure lab** |
| **Seller (demo)** | `/seller` | `member.tema@alkemart.local` | `VendorPass123!` | Tema shop fixture (if seed/runbook applied) |
| **Buyer** | `:5175/signin` | *self-register* | *chosen* | Customer actor only |

**Production:** every seller chooses their own password at Seller Hub register. Admin is created with CLI/invite — **never** public “sign up as admin.”

Create / reset admin:

```bash
cd /home/amber/alkemart-backend/packages/api   # or apps/backend/packages/api
bunx medusa user -e ops@yourdomain.com -p 'StrongPasswordHere'
```

---

## 6. Environment variables

### 6.1 API (`apps/backend/packages/api/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon pooled `alkemart_marketplace` |
| `DATABASE_URL_UNPOOLED` | Migrations if pooler issues |
| `REDIS_URL` | Workers / events |
| `JWT_SECRET` / `COOKIE_SECRET` | Auth |
| `STORE_CORS` | Include storefront origin(s) |
| `ADMIN_CORS` / `VENDOR_CORS` / `AUTH_CORS` | Panel + auth origins |
| `MERCUR_VENDOR_URL` | Public Seller Hub URL (for redirects/emails) |
| `FILE_BACKEND_URL` | Static uploads |
| `PAYSTACK_*` | Optional MoMo/card (server only) |

Template: `apps/backend/packages/api/.env.template`

### 6.2 Buyer storefront (`apps/storefront/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_MEDUSA_BACKEND_URL` | API origin (e.g. `http://localhost:9000`) |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | From Admin / seed **output** |
| `VITE_MEDUSA_REGION_ID` | Ghana region id |
| `VITE_MEDUSA_SALES_CHANNEL_ID` | Storefront sales channel |
| `VITE_MERCUR_VENDOR_URL` | Link to Seller Hub (UI: “Seller Hub”) |
| `VITE_MERCUR_ADMIN_URL` | Link to Admin (UI: “Admin”) |

Template: `apps/storefront/.env.template`  
**Never invent** publishable key / region / SC ids in code.

---

## 7. Procedure: bring the platform up (cold start)

### P0 — Infrastructure

1. **Postgres** — Neon project/DB `alkemart_marketplace` (not Express `neondb`).  
2. **Redis** — local or managed; set `REDIS_URL`.  
3. **Node ≥ 20, Bun ≥ 1.3**.

### P1 — Backend

```bash
# From monorepo root
bun run neon:connect          # wires DATABASE_URL when using Neon CLI
bun run backend:sync          # WSL → /home/amber/alkemart-backend
bun run backend:migrate
bun run dev:backend:fast      # preferred on WSL
```

Or:

```bash
cd /home/amber/alkemart-backend/packages/api
bun install
bunx medusa user -e admin@… -p '…'   # if no admin yet
# start API + panels per package scripts / turbo
```

### P2 — Buyer storefront

```bash
# Prefer Linux copy on WSL (Vite on /mnt/c often freezes)
rsync -a --exclude node_modules --exclude dist \
  /mnt/c/src/Alkemart4/apps/storefront/ /home/amber/alkemart-storefront/
cd /home/amber/alkemart-storefront
cp .env.template .env   # fill from Admin/seed OUTPUT
bun install
bun run dev             # :5175
```

### P3 — Commerce config (Admin UI)

In **Admin** (`/dashboard`):

1. Region: **Ghana**, currency **GHS**, country **GH**  
2. Sales channel used by the storefront  
3. Publishable API key for that channel  
4. Copy region id, sales channel id, publishable key → storefront `.env`  
5. Payment providers when leaving Mode B (Paystack server keys on API)

### P4 — Branding (already scaffolded)

- Seller/Admin: titles, logo, `alkemart-brand.css`, login wordmark  
- After brand edits: hard-refresh panels or restart panel Vite/API bundle  
- Details: `2026-07-17-alkemart-panel-branding.md`

---

## 8. Procedure: complete seller E2E (upload → live on shop)

This is how sellers **post and sell** (commerce model, not pure classifieds).

```text
Seller Hub register
    → create shop (often pending_approval)
        → Admin approves seller
            → Seller: stock location + sales channel link
            → Seller: product (+ images)
            → (optional) Admin confirms product if request flow on
            → Seller: shipping profile/options
            → Seller: offer (price + inventory) + channel visibility
                → Buyer website shows product
                    → Buyer carts with offer_id
                    → COD checkout
                    → Seller fulfills in Seller Hub
```

### Step-by-step (UI)

| # | Who | Action |
|---|-----|--------|
| 1 | Seller | Open http://localhost:9000/seller/register (or storefront `/sell` → Open seller account) |
| 2 | Seller | Create member login + shop profile |
| 3 | Admin | `/dashboard` → find seller → **Approve** |
| 4 | Seller | Login Seller Hub → stock location; link **sales channel** to location |
| 5 | Seller | Create product (draft/proposed as required) |
| 6 | Admin | Confirm product if workflow requires it → **published** |
| 7 | Seller | Shipping profile/options |
| 8 | Seller | Create **offer** (price, stock, variant) |
| 9 | Seller | Ensure product on storefront sales channel / seller linkage as required by backend |
| 10 | Buyer | Open storefront → see product → add to cart → COD |
| 11 | Seller | Orders in Seller Hub → fulfill |

### API-level detail

Use `2026-07-16-mercur-vendor-rbac-catalog-runbook.md` (auth is **member**, header **`x-seller-id`**).

### Lab seller already present (if fixture kept)

- Login: `member.tema@alkemart.local` / `VendorPass123!`  
- Shop: Tema Fresh Goods (example from runbook)

---

## 9. Procedure: complete buyer E2E (Mode B COD)

| # | Action | Surface |
|---|--------|---------|
| 1 | Browse home / departments / search / PDP | Storefront |
| 2 | Add to cart (**requires `offer_id` from API**) | Storefront |
| 3 | Cart → multi-seller groups if multiple shops | Storefront |
| 4 | Checkout: address (saved if signed in) | Storefront |
| 5 | Shipping options from store API attached | Storefront + API |
| 6 | Payment: **COD only** (MoMo shown disabled if present) | Storefront |
| 7 | `POST /store/ghana-checkout` `payment_method=cod` | API |
| 8 | Order confirmation `/order/$id?placed=1` | Storefront |
| 9 | Guest: copy order id; or signed-in: `/orders` | Storefront |

**Fail closed:** no offer → no cart line; no shipping options → place-order fails with real error; no invented prices.

---

## 10. Procedure: admin day-to-day

| Task | Where |
|------|--------|
| Login | `/dashboard` as admin user |
| Approve / suspend sellers | Sellers |
| Confirm product requests | Products |
| Regions, currencies, countries | Settings |
| Sales channels + publishable keys | Settings / API keys |
| Categories | Catalog |
| Marketplace rules / commissions | Mercur admin modules (as enabled) |

Admin does **not** replace Seller Hub for listing every SKU of every merchant.

---

## 11. Complete E2E checklist (definition of “architecture works”)

Use this as a release / demo gate.

### Spine

- [ ] `GET /health` → OK  
- [ ] Neon marketplace DB connected  
- [ ] Redis available for workers (production)  
- [ ] Storefront loads; Seller Hub loads; Admin loads  
- [ ] UI titles show **alkemart** (not engine brands)  

### Config

- [ ] Ghana region + GHS configured  
- [ ] Sales channel + publishable key in storefront env  
- [ ] CORS allows storefront origin  

### Seller → catalog

- [ ] New seller can register  
- [ ] Admin can approve seller  
- [ ] Seller can create product + offer  
- [ ] Product visible on storefront with price and offer  
- [ ] Public seller page `/store/{slug}` works when seller data present  

### Buyer commerce (Mode B)

- [ ] Add offer to cart  
- [ ] Update/remove cart lines  
- [ ] Checkout with real address + country from region  
- [ ] COD order completes with order id  
- [ ] Order detail / guest find-by-id works  

### Accounts

- [ ] Customer register/login/logout  
- [ ] Profile update + addresses + default shipping  
- [ ] Cart transfer on login (best-effort)  

### Branding / entry

- [ ] `/sell` explains seller path and links to Seller Hub  
- [ ] `/partners` maps buyer / seller / admin  
- [ ] Seller Hub + Admin login show alkemart branding  

### Production-ready (beyond Mode B lab)

- [ ] MoMo/Paystack charge-before-commit + webhooks  
- [ ] Cancel / refund / settlement paths  
- [ ] Secrets rotated; no lab passwords  
- [ ] CDN/deploy for storefront; HTTPS panels  
- [ ] Observability (logs, health, errors)  
- [ ] Backups / Neon branch strategy  

---

## 12. What is **in** vs **out** for “complete” today

| In scope (clean slate + greenfield) | Out / later |
|-------------------------------------|-------------|
| Three surfaces: shop + Seller Hub + Admin | Dual-home SPA admin/vendor clones |
| Seller self-post catalog via Seller Hub | Pure Jiji chat-only classifieds (unless product pivot) |
| Buyer COD spine | Full MoMo money spine (documented separately) |
| Alkemart UI branding on panels | Fork of entire Mercur UI |
| Express as reference only | Express as production API |

---

## 13. Daily developer procedures

### Sync backend (WSL)

```bash
bun run backend:sync
# or rsync apps/backend → /home/amber/alkemart-backend
```

### Sync storefront (WSL)

```bash
rsync -a --exclude node_modules --exclude dist \
  apps/storefront/ /home/amber/alkemart-storefront/
```

### After pulling

1. `bun install` where needed  
2. `backend:migrate` if schema changed  
3. Restart API + storefront  
4. Re-check env ids if seed re-ran (publishable key / region may change)

### Proof a change did not invent data

- Network tab: storefront only hits store API + configured backend URL  
- No new hardcoded `offer_` / `pk_` / `reg_` in TS  

---

## 14. Production deployment sketch

| Piece | Procedure |
|-------|-----------|
| API | Deploy `packages/api` with Neon + Redis + secrets |
| Seller Hub | Build `apps/vendor` → serve at `https://seller.…` or `https://api.…/seller` |
| Admin | Build `apps/admin` → `https://admin.…` or `/dashboard` |
| Storefront | Build `apps/storefront` → CDN/static host; env from CI secrets |
| DNS | Shop, seller, admin origins in CORS |
| First admin | CI one-shot or secure runbook `medusa user` — not public register |
| Sellers | Production register URL only on Seller Hub; market via `/sell` |

---

## 15. Mental model (one paragraph)

**Alkemart is a multi-vendor commerce marketplace:** shoppers use the **website**; merchants **register and upload products in Seller Hub**; you **govern the platform in Admin**. Listings flow API → website; orders flow website → API → Seller Hub for fulfillment. Complete E2E means spine + config + seller live catalog + buyer COD (lab) or full payments (production) — all without inventing commerce data or re-homing seller/admin into the buyer SPA.

---

## 16. Quick command card

```bash
# Health
curl -s http://localhost:9000/health

# Admin (lab)
open http://localhost:9000/dashboard
# admin@alkemart.local / supersecret

# Seller (lab)
open http://localhost:9000/seller
# member.tema@alkemart.local / VendorPass123!

# Buyer
open http://localhost:5175
open http://localhost:5175/sell
```

---

**Document owner:** architecture / product  
**Update when:** ports, env names, auth actors, or Mode B → Mode A payment status changes.
