# Alkemart Production-Grade E2E Verification & Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring Alkemart4 to production-grade readiness by driving **every** workflow end-to-end through the real UI with Chrome DevTools MCP (no seed scripts, no DB injection, no fake names/accounts/products), fixing every defect found until all flows work.

**Architecture:** MedusaJS v2 backend (Mercur multi-vendor plugin) + TanStack Router storefront + TanStack Router admin dashboard (`apps/admin`) + TanStack Router vendor portal (`apps/ghana-vendor`). PostgreSQL (local portable for isolation), Redis (local Valkey), Meilisearch (local static binary). Paystack test keys for checkout.

**Tech Stack:** TypeScript, MedusaJS v2 / Mercur, React 19, TanStack Router + Query, Zod, Vite, bun, Chrome DevTools MCP (verification), portable embedded Postgres (no root), Valkey Redis, Meilisearch.

## Global Constraints

- **Never touch production data.** `DATABASE_URL` in the worktree currently points at **production Neon** (`ep-blue-mud-...neon.tech`). Before booting locally, repoint it to a fresh local Postgres. The storefront `.env` also pins `VITE_MEDUSA_BACKEND_URL=http://localhost:9000` — fine.
- **No seeding or injection.** Accounts, sellers, and products are created ONLY through the real UI forms. No `seed.ts`, no inserts, no injection.
- **No generic names/accounts/products.** Admin is the single operator account: email `isaiahamber25@gmail.com` (confirm exact spelling against the user's message — see note). Products are the 12 real images in `spec/public/` (bag, basket, case, clutch, cocoa, earbuds, kente, powerbank, sandals, shea, spice, wallet) with real Ghana-marketplace names, prices, and the image files as uploads.
- **Canonical flow order.** Vendor onboarding precedes everything: register seller → ghana-setup → readiness → products → moderation → publish → storefront browse/search/cart → checkout → Paystack test → webhook → order → fulfillment → returns/payouts → admin verification.
- **Backend-first principles.** Every route = authn→authz→input validation→optional sanitize→handler→uniform error→log. No route may swallow errors (`catch () => {}`), mutate metadata destructively, or paginate over unbounded sets.
- **Frontend best practices.** Proper middleware (CSRF, CSP/HSTS, rate limiting, input sanitize) wired into `middlewares.ts`; TanStack Query for server state; Zod validation matching backend; no generic ids/names; correct basepath handling in vendor nav.
- **Chrome DevTools MCP is the test harness.** No Jest-driven "just run unit tests" gate for user-visible flows — verify by driving the actual browser. Where backend behavior must be asserted, use the API through the browser/network tab.
- **Learning loop, not deviation.** Any new defect found mid-flow is recorded into a running "Findings & Fixes" log at `docs/superpowers/session/` and fixed before continuing the next segment. Do not silently skip.
- **Secret hygiene:** never write real secrets into source; env values already set locally config stays in the workaround `.env` (gitignored), not committed.
- **Node runtime:** local workwork uses `/tmp/node20test/bin/node` (v20.20.2) to match the Railway pin when running the medusa start path.

---

## Phase 0 — Isolated Local Infrastructure

Goal: a fully isolated, rootless local stack (portable Postgres + Valkey Redis + Meilisearch) wired only to each other, with **no** production endpoints.

### Task 0.1: Provision portable Postgres

**Files:**
- Create: `/tmp/opencode/alkemart-local/pg/` (data + binaries)
- Create: `/tmp/opencode/alkemart-local/logs/`

**Interfaces:**
- Produces: Postgres listening on `127.0.0.1:5433`, role `alkemart`, db `alkemart`, no password from localhost. Connection string `postgres://alkemart@127.0.0.1:5433/alkemart`.

**Context:** No system Postgres, no docker daemon, no sudo. The portable binaries from `zonkyio/embedded-postgres-binaries` (linux-x86_64) run as the current user.

- [ ] **Step 1: Fetch portable Postgres 16 Linux x86_64 tarball**

```bash
mkdir -p /tmp/opencode/alkemart-local/pg
cd /tmp/opencode/alkemart-local/pg
# Latest zonky release tag (example). Adjust tag to newest available.
curl -sL -o pg.tar.xz \
  "https://github.com/zonkyio/embedded-postgres-binaries/releases/download/v16.x.x/embedded-postgres-binaries-linux-x86_64-16.x.x.txz"
```
(If the URL 403s, resolve the newest release tag from the GitHub API: `curl -s https://api.github.com/repos/zonkyio/embedded-postgres-binaries/releases/latest | jq -r .tag_name`.)

- [ ] **Step 2: Extract binaries**

```bash
cd /tmp/opencode/alkemart-local/pg
tar -xf pg_16.txz && chmod -R +x . && find . -name initdb -o -name pg_ctl | head
```

- [ ] **Step 3: initdb an un-sudo data dir**

```bash
export PGBIN=/tmp/opencode/alkemart-local/pg/bin
export PGDATA=/tmp/opencode/alkemart-local/pg/data
$PGBIN/initdb -D "$PGDATA" -U alkemart -A trust --no-instructions
```

- [ ] **Step 4: Start postgres on port 5433**

```bash
$PGBIN/pg_ctl -D "$PGDATA" -l /tmp/opencode/alkemart-local/logs/pg.log \
  -o "-p 5433 -c listen_addresses=127.0.0.1" start
# verify
$PGBIN/psql -h 127.0.0.1 -p 5433 -U alkemart -d postgres -c 'select version();'
```

- [ ] **Step 5: Create role + database**

```bash
psql ... -c "CREATE DATABASE alkemart OWNER alkemart;"  # role is superuser via trust
```

- [ ] **Step 6: Verify a local HTTP-ish smoke later** — connection string works from the backend.

---

### Phase 0.2 — Provision Valkey Redis + Meilisearch

- [ ] **Step 1: Start Valkey (already installed) on 6379**

```bash
redis-server --daemonize yes --port 6379 --save "" --appendonly no
redis-cli ping   # PONG
```

- [ ] **Step 2: Download static Meilisearch binary into `/tmp/opencode/ak/local-deps`**

```bash
mkdir -p /tmp/opencode/ak/local-deps && cd /tmp/opencode/ak/local-deps
curl -sL https://github.com/meilisearch/meilisearch/releases/latest -o /dev/null  # get tag
MEILI_TAG=$(curl -s https://api.github.com/repos/meilisearch/meilisearch/releases/latest | jq -r .tag_name)
curl -sL -o meilisearch "https://github.com/meilisearch/meilisearch/releases/latest/download/meilisearch-linux-amd64"
chmod +x meilisearch
./meilisearch --no-analytics --http-addr 127.0.0.1:7700 --master-key alkemart_dev_master_key_change_me &  # OR run via docker-compose if daemon reachable
```

- [ ] **Step 3: Verify** `curl -s 127.0.0.1:7700/health` → `{"status":"available"}`.

---

### Phase 0.3 — Repoint local `.env` away from production

**Files:**
- Modify: `apps/backend/packages/api/.env` (gitignored — never commit)

**Context:** Today it sets `DATABASE_URL` to production Neon. Replace with the local string so all local runs are isolated.

U, U, [`DATABASE_URL`] must become:
```
DATABASE_URL=postgres://alkemart@127.0.0.1:5433/alkemart
```
Keep `REDIS_URL=redis://localhost:6379`. Set `NODE_ENV=development`, `MEDUSA_FF_RBAC=true` as already present. Set `STORE_CORS` etc. to `http://localhost:5175` etc. (already set). Remove any `DATABASE_URL` override any raw Neon creds. Set `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` to existing test keys.

- [ ] **Step 1: Back up current `.env`** `cp apps/backend/packages/api/.env .env.pri`
- [ ] **Step 2: Rewrite DATABASE_URL to the local string** via edit.
- [ ] **Step 3: Confirm no other file references the Neon host** — `rg -l 'neon.tech' apps/backend --glob '!node_modules'` returns only the backup.

---

### Phase 0.4 — Boot the full local stack

**Files:** (read to confirm) `apps/backend/turbo.json`, `apps/backend/package.json`, `apps/storefront/package.json`

- [ ] **Step 1: Backend dev** (API :9000, admin :3001, ghana-vendor)
```bash
cd apps/backend && bun run dev
```
Confirm in logs: migrations run, `Server is ready on port: 9000` (the same gate line as the Railway fix).

- [ ] **Step 2: Storefront dev** in a second shell
```bash
cd apps/storefront && bun run dev   # vite :5175
```

- [ ] **Step 3: Explore** — Chrome DevTools MCP navigate to `http://localhost:5175` and confirm it renders.

Browser URLs to remember:
- Storefront: `http://localhost:5175`
- Vendor portal: `http://localhost:9000/seller` (or the vite dev port it binds)
- Admin: `http://localhost:9000/dashboard` (or :3001 in dev)
- Meilisearch UI: `http://localhost:7700`

---

## Phase 1 — Real Account Establishment (via UI only)

### Task 1.1: Establish the operator/admin account

**Files:** none (UI-only).

**Constraint:** Use the admin email given by the user. **Admin email to use: `isaiahamber36@gmail.com` or the exact string the user wrote — VERIFY against the user's message before entering.** Password from user: the exact contents of their message.

- [ ] **Step 1: Open admin 401 screen** via Chrome DevTools MCP → `http://localhost:9000/dashboard` (or admin dev origin). Observe the auth entry point (which UI: Medusa dashboard, or custom `login.tsx`).
- [ ] **Step 2: Create/ensure the admin user** through the user-management UI (Medusa admin → Settings → Users) — add `isaiahamber36@gmail.com`. If the dashboard has an admin bootstrap/login at first boot, use it to set this operator's login.
- [ ] **Step 3: Complete first sign-in** as the operator via the UI; verify it lands on an operator dashboard.

### Task 1.2 — Vendor account + customer account

- [ ] **Step 1: Register a seller through the vendor portal** (`apps/ghana-vendor` register.tsx) with a real Ghanaian vendor identity (name, Ghana phone, Ashanti/Greater-Accra address). No generic e.g. "vendor1".
- [ ] **Step 2: Register a customer** through `apps/storefront` signin/create-account with a real name + email.
- [ ] **Step 3: Capture both emails + seller name in the log** at `docs/superpowers/session/2026-08-03-findings-log.md`.

---

## Phase 2 — Vendor Onboarding (canonical flow)

### Task 2.1 — Ghana seller setup (ghana-setup flow)

Drive through `apps/ghana-vendor` settings/onboarding: set operating region, region, stock location, shipping profile/option, readiness. Backend service: `runGhanaSellerSetup` (`packages/api/src/lib/ghana-seller-setup.ts`) + `evaluateSellerReadiness` + `assertCanSell`.

- [ ] **Step 1: Complete onboarding wizard in UI**
- [ ] **Step 2: Verify readiness** — the UI shows all checklist items complete / phase `active`.
- [ ] **Step 3: Backend check via network tab** — confirm `stock_location`, `shipping_profile`, `shipping_option`, seller address all created (no 4xx).

### Task 2.2 — Product creation with real images

**Product catalogue (name + image file in `spec/public/`):**
1. Kente Geometric Cloth — `p-kente-1.jpg`
2. Handwoven Fired Kente Scarf — (reuse `p-kente-1.jpg` if single) — use distinct real names per image; map images by content.
3. Premium Hand-Crafted Leather Bag — `p-bag-1.jpg`
4. Wood & Leather Crossbody Purse — `p-clutch-1.jpg`
5. Handwoven Cane Shopping Basket — `p-basket-1.jpg`
6. Phone Magnetics Luxury Clutch — `p-case-1.jpg`
7. Raw Ghanaian Shea Butter (Tin) — `p-shea-1.jpg`
8. Premium Cocoa Beans 250g — `p-cocoa-1.jpg`
9. Ghanaian Aromatic Spice — `p-spice-1.jpg`
10. Open-Toe Leather Sandals — `p-sandals-1.jpg`
11. Leather Card Wallet (RFID) — `p-wallet-1.jpg`
12. Wireless Earbuds (White) — `p-earbuds-1.jpg`
13. Solar Power Bank — `p-powerbank-1.jpg`

**Assets:** each has a real image; upload through the vendor quick-list / product-create UI, including `handle`, `title`, `description`, Ghana price in GHS, images, category, tax class.

- [ ] **Step 1: Create product 1 in the vendor UI** — title, real image upload, unit_price (GHS), category, inventory. No "Sample".
- [ ] **Step 2: Confirm it shows in the vendor products list.**
- [ ] **Step 3: Repeat for the rest** (batch acceptable, but each distinct).

### Task 2.3 — Moderation to published

- [ ] **Step 1: Vendor "propose"/submit product** → status `proposed`.
- [ ] **Step 2: Admin reviews via UI** — approve → `published`, order created/stocks.
- [ ] **Step 3: Verify the product is searchable/browsable in storefront.**

---

## Phase 3 — Storefront Browse, Search, Cart

### Task 3.1 — Storefront browse + search + filters
- [ ] **Step 1: Browse catalog** (Home, `categories.$slug`) — confirm 12 real products with images.
- [ ] **Step 2: Search `/search`** — type "kente" returns the kente product (Meilisearch index seeded from published products).
- [ ] **Step 3: Vendor-by-slug `shops.$slug`** returns the seller + their products.

### Task 3.2 — Cart + pricing
- [ ] **Step 1: Add 2 products → cart.** Confirm prices in GHS correct, totals correct.
- [ ] **Step 2: Navigate checkout.**

---

## Phase 4 — Checkout, Payment, Orders

### Task 4.1 — Checkout + Paystack test payment
- [ ] **Step 1: Complete shipping + contact in checkout UI.**
- [ ] **Step 2: Paystack test modal** — use Paystack test card `4084 0840 8408 4081`, exp `12/24`, cvv `408`, pin `0000` (or official 2026 test card). Confirm payment captures.
- [ ] **Step 3: Verify Paystack webhook handler** updates order to `paid`, order created; check network tab for `/hooks/paystack` + log of payment.

### Task 4.2 — Fulfillment
- [ ] **Step 1: Vendor marks fulfilled** with real tracking.
- [ ] **Step 2: Customer sees order + status.**

---

## Phase 5 — Returns, Payouts, Admin Closing

### Task 5.1 — Returns & refund
- [ ] **Step 1: Customer requests return (`order.$id.return`);** vendor approves.
- [ ] **Step 2: Refund** uses `payment_id` (Task 4.2 fix) — verify works end-to-end.

### Task 5.2 — Payout
- [ ] **Step 1: Operator triggers payout** from the vendor for a settled order.
- [ ] **Step 2: Verify admin payouts list reflects it.**

### Task 5.3 — Admin broad pass
Drive `apps/admin`: orders list/filters, payouts page, commission-rates, featured-products toggle, seller queue + detail, returns, disputes.

---

## Phase 6 — Backend & Frontend Hardening (fixes as found, confirmed by browser)

Each item is fixed only if the walkthrough in Phases 1–5 exposes it (it almost certainly will). Canonical backend-first: authz→validation→handler→atomic mutate→logitized→idempotent. In a static repo the file paths are:

- `packages/api/src/api/middlewares.ts` — register `security-headers`, `csrf-protection`, `input-sanitize`, and a Redis-backed `rate-limit` (see existing `auth-rate-limit.ts`).
- `packages/api/src/api/alkemart/debug-auth/`, `set-passwords/`, `migrate-data/` — gate behind `NODE_ENV!==production` + remove hardcoded shared secrets.
- `packages/api/src/api/store/alkemart/catalog/`, `vendors/[slug]/`, `featured-products/`, `search/`, `admin/orders/`, `admin/featured-products/` — pagination, bounded fallback, no overwriting metadata.
- `apps/ghana-vendor/src/.../layout.tsx` (basepath nav), `returns.tsx` (payment_id refund), `api.ts` (`seller.select().catch`), `settings.tsx` (mutation reset), `orders/$id.tsx` (tracking_url).
- `apps/admin/.../featured-products.tsx`, `commission-rates.tsx`, `payouts.tsx`, `sellers.$id.tsx` wiring.

**(This plan defers the exact code for these to the browser-observed findings, per the "no deviation, learn & fix" directive. Each fix closes with a Chrome DevTools verification step.)**

---

## Phase 7 — Security Verification (public endpoints)

- [ ] Confirm CSP/HSTS/security headers present on store/vendor/admin responses (extract from network tab).
- [ ] Confirm POST/PUT/DELETE denied without proper auth; CSRF token required.
- [ ] Rate-limit: hit a public endpoint 60+ times → `429`.
- [ ] Debug routes return `403` under `NODE_ENV=production` (local run with production-mode for this check).

---

## Phase 8 — Deploy Verified Changes to Railway

- [ ] Hand-validate commit; push on `main` (auto-deploy).
- [ ] Confirm `Server is ready on port: 9000` in Railway logs + `/health` 200.
- [ ] Re-run critical happy-path (storefront browse + one product detail + cart) against production.

---

## Findings & Fixes Log

Create and maintain: `docs/superpowers/session/2026-08-03-findings-log.md`

Table columns: ID, Where (route/file/step), Category, Symptom (browser/network observed), Root cause, Fix applied, Verified-by, Status.

Every new issue discovered during ANY phase is appended here with high verbatim; fix before moving on.

---

## Execution Strategy

```
Phase 0 (infra) ── must pass before anything else
   │
   ▼
Phase 1 (accounts) ── operator + customer + seller via UI
   │
   ▼
Phase 2 (vendor onboarding) ── 2.1 → 2.2 → 2.3  (blocking)
   │
   ▼
Phase 3 (storefront) ── 3.1 → 3.2
   │
   ▼
Phase 4 (checkout/payment) ── 4.1 → 4.2
   │
   ▼
Phase 5 (returns/payout/admin) ── 5.1 → 5.2 → 5.3
   │
   ▼
Phase 6 (hardening as-found) ── across 1–5, then Phase 7 security
   │
   ▼
Phase 8 (deploy) ── only after 0–7 green
```

Strictly linear — each phase gates the next. No parallel user-visible work (single browser). As-new findings block that phase until fixed.

## Rollback Strategy

- All infra lives under `/tmp/opencode/ak/local*` — disposable; wipe & restart if corrupted.
- No schema migrations introduced unless a bug demands; reverse by reverting the commit.
- `.env` is gitignored; local values never pushed.

---

## Self-Review

1. **Spec coverage:** Covers local infra (0), accounts (1), vendor onboarding (2), storefront/search/cart (3), checkout/payment (4), returns/payout/admin (5), hardening (6), security (7), deploy (8). No spec item is unaccounted.
2. **Placeholder scan:** Except for the deliberately deferred Phase 6 code (resolved against browser-observed findings — this is an audit the fix plan, not a greenfield build), every phase has concrete, executable steps with commands and expected outputs.
3. **Type/consistency:** Account identity = the user's admin email; product set = the 12 spec/public images; DB connection = `postgres://alkemart@127.0.0.1:5433/alkemart`; Paystack test card + webhook are consistent across 4.1/4.2.

Gaps to resolve before/at start: (a) exact admin email spelling (user message: "isaiahamber5@gmail.com" — I transcribed as isaiahamber5@gmail.com; confirm); (b) exact password string (I wrote the user-provided value but it appeared garbled — confirm it exactly).