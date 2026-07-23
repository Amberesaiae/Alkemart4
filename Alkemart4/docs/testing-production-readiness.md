# Production readiness testing (Alkemart)

Three layers. All assume **dev/staging servers** are running (API, Redis, panels, shop).

| Layer | Tool | What it proves |
|-------|------|----------------|
| **1. Unit** | Jest (API) + Vitest (storefront) | Env gates, sellable, quality, readiness pure logic |
| **2. API smoke** | Bash **or** Postman/Newman | Health, catalog, auth boundaries, optional authed queues |
| **3. Browser smoke** | Playwright | Shop + Admin + Seller surfaces load with brand/login |

PostHog CLI / self-driving is **analytics product improvement**, not a substitute for these gates.

---

## Layer 1 — unit

```bash
# API (Linux worktree recommended)
cd /home/amber/alkemart-backend/packages/api   # or apps/backend/packages/api
bun run test:unit

# Storefront
cd apps/storefront   # or /home/amber/alkemart-storefront
bun run test
```

---

## Layer 2 — API smoke

### Bash (no install)

```bash
export PK="$(grep VITE_MEDUSA_PUBLISHABLE_KEY apps/storefront/.env | cut -d= -f2-)"
API=http://127.0.0.1:9000 PK="$PK" bun run smoke:onboarding
# or:
API=http://127.0.0.1:9000 PK="$PK" ./scripts/smoke-onboarding-quality.sh
```

### Postman Desktop

1. Import `scripts/postman/alkemart-api-smoke.postman_collection.json`
2. Copy `scripts/postman/alkemart-local.postman_environment.json.example` → `alkemart-local.postman_environment.json`
3. Set `publishableKey` (and optional tokens)
4. Run collection

### Newman (CLI)

```bash
cp scripts/postman/alkemart-local.postman_environment.json.example \
   scripts/postman/alkemart-local.postman_environment.json
# edit publishableKey

bun run smoke:api
# or:
npx --yes newman run scripts/postman/alkemart-api-smoke.postman_collection.json \
  -e scripts/postman/alkemart-local.postman_environment.json
```

Optional env vars in the environment file:

| Variable | Required |
|----------|----------|
| `baseUrl` | yes (default `http://127.0.0.1:9000`) |
| `publishableKey` | for catalog/markets |
| `memberToken` + `sellerId` | onboarding authed |
| `adminToken` | moderation authed |

---

## Layer 3 — browser smoke (Playwright)

```bash
cd e2e
bun install
bun run install:browsers   # once
bun run test:smoke         # surface smoke only
# monorepo: bun run smoke:ui
```

Use **`localhost`** (not `127.0.0.1`) so panel cookies match `VITE_MERCUR_BACKEND_URL`.

---

## Layer 4 — live RBAC multi-vendor audit (no seeding)

Real credentials + real images. **Does not** run seed/inject scripts.

```bash
# Servers: API, Redis, admin :7000, seller :7001, shop :5175
bun run smoke:rbac
# or: cd e2e && bun run test:rbac
```

| Env | Default (lab accounts already in Neon) |
|-----|----------------------------------------|
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `admin@alkemart.local` / `supersecret` |
| `E2E_SELLER_EMAIL` / `E2E_SELLER_PASSWORD` | `seller@alkemart.local` / `supersecret` |
| `E2E_SELLER_STORE_NAME` | `Alkemart Lab Shop` |
| `E2E_PUBLISHABLE_KEY` | from storefront `.env` if unset |

**Atomic phases**

0. Preflight health + real PNG fixtures  
1. API RBAC matrix (admin / seller / fresh buyer) — deny + allow  
2. Browser seller login → multi-store picker (Lab Shop + Lamp Store)  
3. Browser admin login → ops routes  
4. Cross-role: seller session cannot open admin shell  
5. Shop catalog from live API + PDP  
6. Seller uploads **real** `ghana-doorstep-delivery.png` + creates proposed product  
7. Admin moderation summary  

Report: `e2e/reports/rbac-live-latest.json`

---

## Suggested pre-release order

1. Unit green  
2. API smoke green (Newman or bash) on staging URL  
3. Playwright green against staging hosts  
4. Manual: Paystack test charge + R2 upload + one seller approve path  

---

## PostHog

- Project key: `VITE_PUBLIC_POSTHOG_KEY` in storefront `.env` (gitignored)
- CLI / self-driving: run in a **real terminal** (needs TTY):  
  `cd storefront && npx @posthog/wizard@latest self-driving`  
- Not a CI gate for commerce correctness
