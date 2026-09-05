# Freebuff task — thorough live + local lifecycle QA

**Owner:** Freebuff agent  
**Project:** Alkemart (Cloudflare Workers + gold UIs)  
**Goal:** Exercise **every commerce lifecycle and process** against **local** and **live**, report pass/fail with evidence, file gaps against canonical docs.  
**Do not** implement Medusa/Mercur, dual-write, or invent returns/address-book APIs.

---

## 0. Mandatory reading (in order)

1. `docs/architecture/workers/AGNOSTIC-APPROACH.md`  
2. `docs/architecture/workers/AGENT-PLAYBOOK.md`  
3. `docs/architecture/workers/LOCAL-DEV.md`  
4. `docs/architecture/workers/ACID-DATAFLOW.md`  
5. `LIFECYCLE-BUYER.md` · `LIFECYCLE-VENDOR.md` · `LIFECYCLE-ADMIN.md` · `LIFECYCLE-PAYMENT.md`  
6. `NAV-MATRIX.md`  
7. `docs/DEMO-ACCOUNTS.md`  
8. `docs/ops/LAUNCH-GATE-STATUS.md` · `docs/ops/PAYMENTS-LAUNCH-GATE.md`  

Ignore `archive/**`.

---

## 1. Environments

### Live (production-like)

| Surface | URL |
|---------|-----|
| API | `https://alkemart-api.glean-circular-passport.workers.dev` |
| Store | `https://alkemart4-storefront.pages.dev` |
| Vendor | `https://alkemart4-vendor.pages.dev` |
| Admin | `https://alkemart4-admin.pages.dev` |

### Local

```bash
cd Alkemart4
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # JWT_SECRET ≥32 chars
# Each UI .env.local: VITE_ALKEMART_API_URL=http://127.0.0.1:8787
bun run dev:workers
```

| Service | Port |
|---------|------|
| API | http://127.0.0.1:8787 |
| Store | http://127.0.0.1:5175 |
| Vendor | http://127.0.0.1:3002 |
| Admin | http://127.0.0.1:3001 |

If `wrangler` fetch fails on this network:

```bash
NODE_OPTIONS="--dns-result-order=ipv4first -r $PWD/scripts/node-ipv4-fetch-preload.cjs" wrangler …
# or: bun run deploy:pages / bun run deploy:api
```

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Buyer | `buyer@alkemart.test` | `BuyerPass1` |
| Vendor | `vendor@alkemart.test` | `VendorPass1` |
| Admin | `admin@alkemart.test` | `AdminPass1` |

---

## 2. Automated smoke (run first, both envs)

```bash
# Live
bun run smoke
bun run smoke:acid

# Local (API up on :8787)
bun run smoke:local
bun run smoke:acid:local
```

Record: exit code, failing step, raw response snippets.

---

## 3. Lifecycle matrix (do every row on LIVE and LOCAL)

For each row: **API (curl)** + **UI (browser click path)**. Mark Pass / Fail / Blocked + notes.

### A. Buyer

| # | Process | API | UI |
|---|---------|-----|-----|
| A1 | Health / ready | `GET /health`, `GET /health/ready` | — |
| A2 | Register (optional new email) | `POST /store/auth/register` | Store → Create account |
| A3 | Login | `POST /store/auth/login` | Store → Sign in |
| A4 | Category rail | `GET /store/categories` | Header: **exactly 6** depts; **no Pet Care**; popdown shows subcats where children exist |
| A5 | Browse / search | `GET /store/catalog?q=tecno` | Home → search → PLP |
| A6 | PDP + peer offers | `GET /store/products/:id` | Open product; offer pick if multi |
| A7 | Cart create + ATC | `POST /store/cart`, `POST …/items` `{offerId,qty}` | Add to cart |
| A8 | Cart update / remove | `PATCH …/items/:id` | Qty / remove |
| A9 | COD checkout + shipping | `POST /store/checkout` method `cod` + `shippingAddress` | Checkout → COD → place |
| A10 | Order detail | `GET /store/orders/:orderGroupId` + Bearer | Orders / order page shows address |
| A11 | Order list | `GET /store/orders` | Account orders |
| A12 | Guest lookup (if exposed) | `POST /store/orders/lookup` | Any guest UI |
| A13 | Footer contrast | — | Footer links/copy **visible** on dark bar |
| A14 | MoMo pending (lab) | checkout `momo` if keys + feature flag | Pending UI if enabled |
| A15 | Card init (lab) | checkout `card` | Callback / pending if enabled |

**Buyer ACID checks:** OrderGroup created; multi-seller cart → N seller orders; empty cart checkout rejects; shipping persisted.

### B. Vendor

| # | Process | API | UI |
|---|---------|-----|-----|
| B1 | Login | `POST /vendor/auth/login` | Vendor login |
| B2 | Session / me | `GET /vendor/me` | Dashboard loads |
| B3 | Onboarding status | `GET /vendor/onboarding/status` | Settings readiness |
| B4 | Ghana MoMo setup | `POST /vendor/onboarding/ghana-setup` (lab) | Settings MoMo tab |
| B5 | List products | `GET /vendor/products` | Products list (expect Tecno / seeded) |
| B6 | Create / edit product | `POST/PATCH /vendor/products` | Quick-sell / product edit |
| B7 | Propose | `POST /vendor/products/:id/propose` | Propose action if shown |
| B8 | Orders list / detail | `GET /vendor/orders` | Orders |
| B9 | Ship | `POST /vendor/orders/:id/ship` | Order detail ship |
| B10 | Deliver | `POST /vendor/orders/:id/deliver` | Deliver |
| B11 | Returns nav | — | Returns **hidden** or honest unavailable on Workers |

### C. Admin

| # | Process | API | UI |
|---|---------|-----|-----|
| C1 | Login | `POST /admin/auth/login` | Admin login |
| C2 | Sellers list / queue | `GET /admin/sellers` | Sellers / Seller Queue |
| C3 | Approve / suspend | `POST /admin/sellers/:id/approve` etc. | Seller actions |
| C4 | Product moderation | `GET /admin/products`, approve/reject | Product Review |
| C5 | Orders | `GET /admin/orders` | Orders |
| C6 | Payouts | `POST /admin/payouts` `{sellerId}` after deliver | Payouts form |
| C7 | Migrate helpers | `POST /admin/migrate/schema` (idempotent) | — |
| C8 | Workers nav only | — | No analytics/markets/returns linked when Workers API |

### D. Payment / stock (API-heavy)

| # | Process | Expect |
|---|---------|--------|
| D1 | COD confirm | Intent → OrderGroup immediately |
| D2 | MoMo reserve | Pending → `stock_reservations` / reserved bump |
| D3 | MoMo success (webhook or status poll) | Confirm; stock decremented; reservation cleared |
| D4 | MoMo fail | Release reservations; no OrderGroup |
| D5 | Webhook replay | Single OrderGroup / deduped |
| D6 | Card pending | **Also reserves stock** (parity with MoMo) |
| D7 | Amount mismatch | Confirm rejected |
| D8 | Payout uniqueness | Delivered order cannot double-pay `payout_lines` |

Use Paystack **test** keys only. Live money matrix: follow `PAYMENTS-LAUNCH-GATE.md`; mark Blocked if no test keys.

---

## 4. UI / nav regression (store)

Walk `NAV-MATRIX.md` on live store:

- `/`, `/search`, `/categories/*`, `/product/*`, `/cart`, `/checkout`, `/orders`, `/login`, `/account`, `/shops`, `/help`, `/about`, `/contact`, `/delivery`, `/sell`, `/partners`  
- Header: **6** department chips; popdowns work; Pet Care **absent**  
- Footer: text readable on dark background  

Vendor: login → dashboard → products → orders → settings  
Admin: login → sellers → product moderation → orders → payouts  

---

## 5. Explicit out of scope (report as N/A, do not fake)

- Returns / refunds API  
- Address book CRUD  
- Wishlist persistence  
- Vendor image upload on Workers  
- Admin analytics / promotions / categories CRUD  
- Medusa `:9000` / dual-path  

---

## 6. Deliverable format (required)

Write a report (markdown) with:

1. **Env checklist** — local up? live reachable? smoke/acid exit codes  
2. **Matrix table** — every A/B/C/D row: Live | Local | Pass/Fail/Blocked | evidence (status codes, orderGroupId, screenshot paths)  
3. **Bugs** — severity (P0 money/stock, P1 UX broken, P2 polish), steps, expected vs actual  
4. **Doc drift** — where code ≠ `docs/architecture/workers/*`  
5. **Recommendations** — next fixes only; no Medusa revival  

Suggested path for the report:

`docs/architecture/workers/reports/freebuff-lifecycle-qa-YYYY-MM-DD.md`

---

## 7. Definition of done for this Freebuff task

- [ ] Smoke + acid run on live  
- [ ] Smoke + acid run on local (or Blocked with reason)  
- [ ] Full A/B/C/D matrix filled  
- [ ] Header rail verified: **6 depts**, popdowns, no Pet Care  
- [ ] Footer contrast verified  
- [ ] Report filed with evidence  
- [ ] No production secret commits; no push unless human asks  

---

## 8. Quick curl cheat sheet

```bash
API=https://alkemart-api.glean-circular-passport.workers.dev   # or http://127.0.0.1:8787

curl -sS "$API/health/ready"
TOKEN=$(curl -sS -X POST "$API/store/auth/login" -H 'content-type: application/json' \
  -d '{"email":"buyer@alkemart.test","password":"BuyerPass1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Catalog + COD (see scripts/e2e-workers-acid.sh for full script)
```

Prefer extending / reusing `scripts/e2e-workers-smoke.sh` and `scripts/e2e-workers-acid.sh` over one-off scripts.
