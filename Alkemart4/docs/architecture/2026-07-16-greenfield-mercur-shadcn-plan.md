# Greenfield plan: Mercur + shadcn buyer SPA (as if starting new)

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | Planning — **not** Mode B lab work; future rebuild direction |
| **Premise** | Ignore dual-home Express/Medusa patches. Design the system we would build if Alkemart started tomorrow. |
| **UI stance** | Buyer SPA = **shadcn/ui + Radix + Tailwind**. Seller/admin = **Mercur dashboards** (don’t re-skin as SPA ops). |

---

## 1. What went wrong (so we don’t repeat it)

| Anti-pattern | Why it hurt |
|--------------|-------------|
| One SPA for buyer + admin + vendor | Dual-home forever; “unclog” was cleanup of a bad starting shape |
| Express stubs + Medusa + Mercur | Three write paths; honesty gates and `/api` proxies |
| Curl-green as “done” | Adapters without a product order contract |
| Cart metadata as payment ledger | MoMo without a real money state machine |
| Dual worktrees | Runtime ≠ git source of truth |
| Custom UI one-offs without a kit | Inconsistent chrome; hard to restyle Ghana brand |

**Greenfield rule:** one commerce engine, one buyer UI system, zero dual-home.

---

## 2. Target system (from day zero)

```text
┌─────────────────────────────────────────────────────────────┐
│  packages/ui  (optional monorepo kit)                       │
│  shadcn primitives + Alkemart tokens (yellow/white/black)   │
└───────────────────────────┬─────────────────────────────────┘
                            │ used by
┌───────────────────────────▼─────────────────────────────────┐
│  apps/storefront  (buyer only)                              │
│  Vite + React + TanStack Router/Query                       │
│  Medusa JS SDK → store API only                             │
│  Screens composed from shadcn + domain components           │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│  apps/backend  (Mercur = Medusa + marketplace)              │
│  :9000 store + auth + /seller + /dashboard                  │
│  Alkemart modules: Paystack Ghana, thin Ghana checkout      │
│  Neon Postgres · Redis · single worktree                    │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ Mercur Vendor UI             │ Mercur Admin UI
         │ (don’t rebuild in SPA)       │ (don’t rebuild in SPA)
```

| Actor | UI | API |
|-------|----|-----|
| Buyer | **Our** storefront (shadcn) | Medusa **store** + rare Alkemart adapters |
| Seller | **Mercur** `/seller` | Vendor / member APIs |
| Admin | **Mercur** `/dashboard` | Admin APIs |

No SPA `/admin`, `/vendor`, Express dual-home, or “ops backend flag.”

---

## 3. UI strategy: shadcn / Radix (yes — do this)

### 3.1 Why shadcn is the right bet for the **buyer** SPA

You **already** have shadcn (New York style) + a full Radix set under `artifacts/alkemart/src/components/ui/`. The problem is not missing primitives — it’s:

1. **Domain screens** built ad hoc on top of primitives without a design system layer.  
2. **Copy/flows** that claimed MoMo/production while architecture was lab.  
3. **No shared `packages/ui`** — storefront owns everything; hard to reuse or theme.

**Opinion:** Don’t throw away shadcn. **Discipline** it.

| Layer | What lives there | Rule |
|-------|------------------|------|
| **L0 — tokens** | CSS variables, yellow/white/black, type scale, spacing | One `globals.css` / theme |
| **L1 — shadcn/ui** | Button, Input, Dialog, Sheet, Form, Card… | Generated via CLI; thin wrappers only |
| **L2 — domain** | `ProductCard`, `Price`, `OrderSummary`, `AddressForm`, `CheckoutStepper` | Built **only** from L1; no raw HTML buttons |
| **L3 — screens** | Routes compose L2 + data hooks | No business logic in dumb presentational L2 |

Mercur admin/vendor already use **@medusajs/ui** + dashboard SDK. **Do not** force shadcn into Mercur panels. Two design systems for two products is correct:

- Buyer brand = Alkemart shadcn  
- Ops = Mercur/Medusa UI (upstream)

Trying to unify them wastes months for no buyer value.

### 3.2 How to “start using reusable components” properly

1. **Inventory** current L2 (`components/shop/*`) → mark keep / rewrite / delete.  
2. **Extract tokens** from `index.css` into a documented theme (shadcn CSS vars).  
3. **Component contract:** every new UI is either CLI shadcn or L2 built from shadcn.  
4. **Storybook or mockup-sandbox** (you already have `mockup-sandbox`) for L2 only.  
5. **No new one-off CSS** in routes — variants via `cva` / `button` variants.

Optional monorepo shape:

```text
packages/ui/          # shadcn + L2 Ghana domain
apps/storefront/      # routes + hooks only
apps/backend/         # Mercur (unchanged role)
```

Only extract `packages/ui` when a **second** consumer needs it (e.g. marketing site). Until then, `src/components/ui` + `src/components/commerce` is enough.

---

## 4. Backend strategy: Mercur as the product, not a patch target

### 4.1 Day-0 Mercur responsibilities

| Domain | Owner |
|--------|--------|
| Regions, GHS, sales channels | Medusa core + seed |
| Sellers, offers, product request | Mercur |
| Cart with **offer_id** | Mercur store cart |
| Split orders / commissions | Mercur (when multi-seller is in scope) |
| Admin approve seller/product | Mercur dashboard |
| Seller list/fulfill | Mercur seller panel |

### 4.2 Alkemart-owned modules only (thin)

| Module | Why custom |
|--------|------------|
| Paystack Ghana (MoMo charge + webhook + pesewas) | Not in Mercur OOTB |
| Ghana checkout adapter | Single store entry for COD + MoMo state machine |
| Optional: storefront “me” / public seller card | Only if SDK is insufficient |

**Do not** rebuild: promotions CMS, admin users UI, vendor analytics SPA, Express conversations.

### 4.3 Money spine (build before UI polish)

If starting clean, order of backend work:

1. Seed: Ghana region, SC, publishable key, one open seller, one offer, shipping option.  
2. COD complete cart (system payment) + **order with display_id**.  
3. Payment intent entity (or Medusa payment collection discipline) — not cart metadata forever.  
4. MoMo: charge → pending → webhook → complete; amount invariant; refund-on-complete-fail.  
5. Customer-linked cart always.  
6. Only then multi-seller / settlement.

UI without 1–5 is theater again.

---

## 5. Storefront architecture (greenfield SPA)

### 5.1 Stack (keep what works)

| Concern | Choice |
|---------|--------|
| Build | Vite |
| Router | TanStack Router (file routes) |
| Data | TanStack Query + Medusa JS SDK |
| Forms | RHF + Zod + shadcn Form |
| Auth | Medusa customer emailpass |
| Config | `region_id`, `sales_channel_id`, publishable key |

### 5.2 Route map (buyer only — freeze this list)

```text
/                   home
/browse/*           PLP
/ip/$id             PDP
/cart
/checkout
/orders
/order/$id
/account/*
/store/$slug        seller storefront (read-only)
/signin/*
/help, /terms, /privacy
```

Links **Sell** / **Admin** → external Mercur URLs. Period.

### 5.3 Data hooks (one folder, no Express)

```text
src/lib/api/
  products.ts
  cart.ts
  checkout.ts      # ghana-checkout + poll
  orders.ts
  customer.ts
  sellers.ts       # public seller by handle if needed
```

No `api-stubs.ts`. Features without backend = honest empty state, not fake success.

### 5.4 Screen → component mapping (shadcn-first)

| Screen | L2 building blocks |
|--------|--------------------|
| Home | `Hero`, `ProductRail`, `CategoryTile`, `FeatureGrid` |
| PLP | `ProductCard`, `FilterSheet`, `Pagination` |
| PDP | `ImageGallery`, `Price`, `AddToCartButton`, `SellerChip` |
| Cart | `LineItem`, `OrderSummary` |
| Checkout | `Stepper`, `AddressForm`, `PaymentMethod`, `OrderSummary` |
| Orders | `OrderRow`, `EmptyState` |
| Order detail | `StatusBadge`, `AddressCard`, `LineItem` (read-only) |

Each L2 file imports only `@/components/ui/*` + tokens.

---

## 6. Phased build (from scratch)

### Phase 0 — Scaffold (1–2 days)

- Mercur app via official create path (you already have this — **keep API**, reset SPA mentally).  
- Neon branch `alkemart_lab` or fresh.  
- Single Linux worktree for API.  
- Storefront skeleton: tokens + shadcn + layout shell.  
- Seed script: region GH/GHS, SC, key, 1 seller, 1 product+offer, shipping.

**Exit:** `GET /store/products` ≥1 with `offer_id`; SPA home renders shell.

### Phase 1 — Catalog + cart (3–5 days)

- Product list/detail with shadcn cards.  
- Cart create/add/update/delete with **offer_id**.  
- Empty states honest.  

**Exit:** Browser: add offer → cart total correct GHS.

### Phase 2 — COD purchase (5–7 days) — **first real “done”**

- Address form (shadcn Form).  
- Shipping options (flatten Mercur seller map in one helper).  
- Checkout COD only.  
- Order list/detail with **display_id** or explicit lab label policy.  
- Transfer cart on login.  

**Exit:** Browser DoD: register → COD → **Order #N** (or honest lab ref) on list. **No curl-only celebration.**

### Phase 3 — Ghana brand + density (parallel, after Phase 2)

- Categories, more products via Seller Hub.  
- Homepage modules from CMS later (or static sections using L2).  
- A11y pass on checkout.

### Phase 4 — MoMo money spine (only when Phase 2 solid)

- Intent table or payment-collection-first design.  
- Charge + webhook + poll.  
- UI: MoMo selector as first-class **after** spine works.  
- Settlements later (Phase 5+).

### Phase 5 — Marketplace maturity

- Multi-seller cart, commissions, disputes, real cancel matrix.  
- Still no SPA admin.

---

## 7. What to keep vs throw from Alkemart4 today

| Keep | Throw / freeze |
|------|----------------|
| Mercur API knowledge, seed patterns, Ghana region | Express as runtime |
| Paystack client + pesewas math | Cart-metadata-as-ledger long term |
| shadcn ui primitives + yellow tokens | SPA admin/vendor routes (already deleted) |
| Clean-slate ADR roles (buyer SPA / Mercur ops) | Dual worktree discipline failures |
| Mode B honesty about COD | Marketing copy that claims MoMo production |
| Vendor RBAC runbook | Gap-map “fix all cells” as a plan |

**Pragmatic path:** not a full disk wipe. Treat greenfield as:

1. **Freeze Mode B** (done).  
2. **New branch / workstream** “storefront-v2” or rebuild routes on a clean `apps/storefront` that only consumes Mercur + shadcn L2.  
3. **Backend:** evolve Mercur in place; stop bolting dual-home.  
4. Port only Phase 1–2 screens; leave lab SPA as reference.

Full monorepo rewrite is optional; **mental greenfield + folder boundaries** is mandatory.

---

## 8. Team process (anti-loop)

| Rule | Practice |
|------|----------|
| Definition of done | **Browser path** written before coding |
| One spine owner | Money/order contract owned by one design doc |
| UI PRs | Must use L1/L2; no new raw controls in routes |
| Backend PRs | No new `/store/alkemart/*` without “why SDK can’t” |
| Demo script | One markdown runbook; update when path changes |
| No dual claims | Lab vs production explicitly labeled in UI |

---

## 9. Recommended decision for Alkemart **now**

Given Mode B is accepted:

| Option | When |
|--------|------|
| **A. Stay in Mode B** | Demos only; no architecture ambition this week |
| **B. Greenfield storefront-v2** | You want clean shadcn composition + Mercur-only data (this plan Phases 0–2) |
| **C. Mode A money spine first** | You care more about MoMo/settlements than UI kit |

**Best order if you want both UI quality and credibility:**

1. Phase 0–2 greenfield **buyer** (shadcn + COD) on Mercur.  
2. Then Phase 4 money spine.  
3. Never rebuild Mercur admin in shadcn.

That is the pragmatic “start over” without throwing the marketplace engine away.

---

## 10. Non‑negotiable: **no hardcodes, no magic**

This is binding for any greenfield or Mode A work. Mode B lab debt may still contain sins; **new code must not**.

### 10.1 Definitions

| Term | Meaning |
|------|---------|
| **Hardcode** | Commerce or env facts baked into source: IDs, keys, URLs, prices, seller handles, emails, passwords, region/SC, offer/product ids |
| **Magic** | Silent fallbacks that invent data so the UI “works”: fake keys, empty success stubs, invented stock/prices, default `customer@…` emails, “if fail return [] and look fine” |

### 10.2 Banned in application code

| Banned | Why | Correct source |
|--------|-----|----------------|
| `offer_01…`, `prod_…`, `reg_…`, `sc_…`, `sel_…`, `order_…` in SPA/API business logic | Environment-specific | Query API / seed **output** docs only |
| Publishable / secret API keys in repo | Security + portability | `.env` (gitignored), secrets manager |
| `pk_default` or invented keys | Silent store failures | Fail fast: missing env = hard error |
| Prices, stock, catalog titles as product truth in frontend | Lies | Medusa/Mercur store responses |
| Hardcoded Ghana postcodes / free shipping amounts as “policy” without config | Policy drift | Env or admin-configured rules |
| Fallback email `customer@alkemart.local` on charges | Bad charges, invalid Paystack | Require real customer email or fail |
| Express `/api` stubs that toast success with no backend | Dual-home theater | Feature off or real Medusa route |
| Dual worktree “copy this path” as architecture | Drift | One runtime tree |

**Seed scripts** may use fixed passwords/handles for local bootstrap **only** if:

1. Documented as local-only,  
2. Never imported by SPA,  
3. Not used in production deploys without override.

### 10.3 Allowed (not “magic”)

| Allowed | Condition |
|---------|-----------|
| Env vars (`VITE_*`, `DATABASE_URL`, `PAYSTACK_*`) | Required vars fail loud if missing |
| **Display** copy / empty-state strings | Not commerce truth (no fake prices) |
| Design tokens (colors, spacing) | Theme, not business data |
| Enums from domain contracts (`cod` \| `momo`) | Shared schema / Zod, not scattered strings |
| Dev-only localhost backend URL | Explicit, documented, **prod throws** |
| Mapping pure functions (pesewas ↔ major, MoMo provider → Paystack slug) | Deterministic conversion, inputs from API/env |

### 10.4 Config surface (greenfield)

```text
SPA (.env — never committed secrets)
  VITE_MEDUSA_BACKEND_URL
  VITE_MEDUSA_PUBLISHABLE_KEY
  VITE_MEDUSA_REGION_ID          ← from Admin/seed output, not invented in code
  VITE_MEDUSA_SALES_CHANNEL_ID
  VITE_MERCUR_VENDOR_URL
  VITE_MERCUR_ADMIN_URL
  VITE_FEATURE_*                 ← explicit flags only

API (.env)
  DATABASE_URL, REDIS_URL
  STORE_CORS, AUTH_CORS, …
  JWT_SECRET, COOKIE_SECRET
  PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY   ← optional until MoMo phase
  FILE_BACKEND_URL
```

**Bootstrap flow (no magic IDs in git):**

```text
1. medusa seed / admin creates region, SC, key, seller, offer
2. seed prints or writes .env.local.example values (or a small env:print script)
3. developer copies real IDs into .env
4. SPA refuses to start store calls without those vars
```

Never commit live `reg_01…` / `pk_…` into TypeScript.

### 10.5 Runtime rules

1. **Fail closed** — missing config or API error → error UI / HTTP error, not empty success.  
2. **Single source of commerce truth** — Medusa/Mercur responses.  
3. **No dual write paths** — no Express + Medusa for the same action.  
4. **Feature flags are explicit** — e.g. MoMo lab only with `VITE_FEATURE_MOMO_LAB=true`, default off.  
5. **Adapters map, they don’t invent** — flatten seller-keyed shipping is OK; inventing a shipping option id is not.

### 10.6 PR checklist (reject if violated)

- [ ] No new entity IDs or API keys in source (except tests with fixtures clearly marked).  
- [ ] No `|| "fake"` commerce defaults.  
- [ ] New env vars documented in `.env.template` (empty values).  
- [ ] Seed outputs documented; SPA does not embed seed IDs.  
- [ ] UI empty states are honest when catalog/payment missing.

---

## 11. Directory decision (accepted)

| Question | Answer |
|----------|--------|
| New directory? | **Yes** — `apps/storefront` |
| Mode B lab? | **Frozen** at `artifacts/alkemart` (port 5175) |
| Greenfield SPA? | `apps/storefront` (port **5180**) |
| Backend? | Mercur `apps/backend` / Linux worktree — not rewritten into SPA |
| Extract `packages/ui`? | **After** Phase 2 |
| Brand tokens? | Yellow / white / black only |

### Open (later)

- COD-only Phase 2 enough for first external demo? (default yes)  
- Engineer track split UI/backend?

---

## Summary opinion

- **Mercur as the backend product** — correct; don’t dual-home.  
- **shadcn/Radix as the buyer design system** — correct; enforce L1/L2.  
- **No hardcodes / no magic** — commerce config from env + API only; fail closed.  
- **Don’t shadcn-ize Mercur admin/seller** — wrong ROI.  
- **Rebuild from screen + money contracts**, not adapters.  
- **Phase 2 COD in browser** is the first real “we built something.”

When you want to execute: choose folder strategy (question 1), freeze Phase 0–2, implement only that vertical slice under §10.
