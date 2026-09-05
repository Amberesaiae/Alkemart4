# Multi-vendor marketplace — full diagnosis (Alkemart)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-16 |
| **Status** | Research + codebase audit (authoritative for planning) |
| **Audience** | Product + engineering |

This document answers: (1) how a multi-vendor marketplace is *supposed* to work, (2) whether Neon is a good DB choice, (3) Alkemart gap map vs that ideal, (4) UI/UX diagnosis and treatment plan.

---

## 1. How multi-vendor ecommerce is supposed to work (from scratch)

A marketplace is **not** a single-seller shop with a “vendor” label. It is a **three-sided platform**: buyers, sellers (vendors), and operators (admin/support). Money, inventory, fulfillment, and trust all flow through **platform rules**.

### 1.1 Core domains (leave nothing out)

| Domain | Purpose | Typical entities |
|--------|---------|------------------|
| **Identity & RBAC** | Who can do what | Buyer, vendor_owner, vendor_staff, support, admin; org/vendor membership |
| **Vendor lifecycle** | Onboarding → sell → suspend | Application, KYC, shop profile, commission, payout account, status |
| **Catalog** | Unified discovery, per-vendor ownership | Product, variant, media, category, brand; **vendor ownership link** |
| **Inventory** | Stock truth | Per-vendor stock (or stock location owned by vendor); reservations on cart/checkout |
| **Pricing** | List/sale price | Vendor-set or platform-controlled; currency (GHS); promotions allocation rules |
| **Discovery** | Find products | Search, facets, merchandising homepage, vendor storefronts |
| **Cart** | Cross-vendor basket | Line items with vendor_id; optional group-by-seller UI |
| **Checkout** | Collect address, shipping, pay | Shipping options (per vendor or platform); payment capture; **order formation** |
| **Orders** | Buyer contract | One parent order or split child orders **per vendor** (choose one model and stick to it) |
| **Fulfillment** | Ship per seller | Per-vendor status: unfulfilled → packed → shipped → delivered |
| **Payments** | Collect money | Card/MoMo; async states; webhooks; refunds |
| **Settlements / payouts** | Pay sellers | Commission bps, ledger, mark-paid or auto Transfer; hold periods |
| **Disputes / support** | After-sales | Order-linked tickets, refund policy, messaging |
| **Trust & content** | Ratings, images, CMS | Reviews, moderation, homepage modules |
| **Notifications** | Event-driven | Order placed, shipped, payment failed, settlement |
| **Ops / admin** | Platform control | Vendors, commissions, promos, roles, analytics |

### 1.2 Canonical buyer journey

```
Browse / search / category
  → PDP (image, price, sold-by vendor, stock honesty)
  → Add to cart (may mix vendors)
  → Cart (group by seller optional; shipping preview)
  → Auth (if guest)
  → Address + shipping method(s)
  → Payment (MoMo async OR COD)
  → Order confirmation
  → Order tracking (per shipment if multi-vendor)
  → Returns / dispute
```

### 1.3 Canonical vendor journey

```
Apply / invited → admin approve → role grant (vendor_owner)
  → Complete shop profile + payout recipient
  → Create products + stock + media (moderation optional)
  → Receive order notifications
  → Fulfill own lines only (pack/ship)
  → View analytics + settlements
  → Message support/buyer (optional)
```

### 1.4 Canonical platform (admin) journey

```
Approve/suspend vendors
  → Set commission_bps, badges
  → Assign roles (admin/support/vendor_staff)
  → Moderate products/images
  → Resolve disputes
  → Generate/mark settlements (or automate Transfers)
  → Merchandising (homepage, promos)
  → Observe platform metrics
```

### 1.5 Two valid order models (pick one)

| Model | Description | Pros | Cons |
|-------|-------------|------|------|
| **A. Single order + multi-fulfillment** | One `order` for the buyer; **one fulfillment per vendor** | Simple buyer view; matches Alkemart Express today | Cancel/refund across vendors is harder |
| **B. Split child orders** | Cart complete → N orders (one per vendor) | Clean seller isolation; Medusa recipe often uses this | Buyer sees multiple order numbers |

**Alkemart Express design (documented ADR):** Model **A**. Medusa path must re-implement the same economics or **explicitly** switch to B with SPA changes.

### 1.6 Money flow (marketplace)

```
Buyer pays platform (full cart)
  → Platform holds / captures funds
  → On delivered (or policy window): settlement line
       gross = sum of vendor's items
       commission = floor(gross * commission_bps / 10000)
       net = gross - commission
  → Admin mark-paid OR Paystack Transfer to vendor recipient
```

Promo discount policy (Alkemart ADR-009): **marketplace absorbs promo** in v1 (commission on full line subtotals). Document any change.

### 1.7 Medusa-specific best practices (upstream)

Official Medusa marketplace recipe:

1. Custom **marketplace module** (vendor, staff)
2. **Module links** vendor↔product, vendor↔order
3. **Authenticated vendor actor** APIs (not open store APIs)
4. **Split / associate orders** at complete-cart (workflow)
5. Vendor dashboard (custom app or admin extensions)
6. Storefront shows sold-by / vendor storefronts

Medusa is **headless single-store by default**; multi-vendor is **custom**, not a checkbox. Ecosystem options (Mercur, TechLabi plugin) exist; Alkemart chose custom modules — that is fine if **operations APIs are finished**.

### 1.8 Platform product best practices (UX)

1. **Trust density** on every tile: price, image, sold-by, rating, stock/ship honesty  
2. **One backend** for buyer/seller/admin — no “ghost” menus  
3. **Error ≠ empty catalog**  
4. **Fulfillment story consistency** (header / cart / checkout same model)  
5. **Honest async payment** (MoMo pending, not fake success)  
6. **Brand system** for market (Ghana marketplace, not residual US big-box lexicon)

---

## 2. Is Neon a good fit for Alkemart’s database?

### 2.1 Verdict

**Yes — Neon is a good choice for Alkemart**, with conditions.

| Factor | Assessment |
|--------|------------|
| Postgres compatibility | Medusa + Drizzle/Express both need Postgres → Neon fits |
| Branching | Excellent for migration testing (schema branch, ETL dry-run) without cloning prod |
| Scale-to-zero | Good for cost in dev/staging; **wake latency** hurts local agent/CI (we already saw ETIMEDOUT / cold starts) |
| Connection model | Serverless → **must use pooled connections** for Medusa/Express (`-pooler` host); avoid raw 5432 from many serverless workers |
| Multi-DB | ADR-P1 correct: **separate Medusa DB/branch** from Express `neondb` until cutover |
| Ops | Autoscaling, backups, branching; less ops than self-hosted Postgres |
| Multi-tenant marketplace | Neon is **not** multi-tenant isolation by itself — tenancy is **application-level** (vendor_id on rows). Neon is fine as shared DB |

### 2.2 When Neon hurts (observed)

- WSL/agent environments hitting **non-pooled** or cold Neon → timeouts  
- Dual databases during migration increase cognitive load (two URLs, ETL, dual-home SPA)  
- Without Redis, Medusa already uses fake redis — Neon doesn’t solve session/cache  

### 2.3 Recommendations

1. Keep Neon; enforce **pooled** `DATABASE_URL` for runtime  
2. Keep **dedicated** `alkemart_medusa` (or branch) — do not mix Express tables into Medusa schema long-term  
3. Use Neon branches for: ETL rehearsal, RBAC migrations, settlement module  
4. Add **connection retry + pool max** tuned for Neon (Medusa/pg)  
5. For production high traffic: disable aggressive scale-to-zero on primary or accept first-request latency; consider compute that stays warm  
6. **Do not** expect Neon to replace Redis for queues/event bus — plan Redis (or Neon + outbox) for multi-instance  

**Bottom line:** Neon is the right *managed Postgres* for this stack. Gaps are **application marketplace completeness**, not Neon fitness.

---

## 3. Alkemart as-built vs ideal (gap map)

### 3.1 Strengths (do not throw away)

| Area | Status |
|------|--------|
| Express multi-vendor spine | Real: product.vendorId, multi-fulfillment, commission fields, settlement generate/mark-paid, CASL + row checks |
| Commercial ADRs | Strong docs: MoMo async, cancel compensation, settlement v1 |
| Ghana checkout on Medusa | Custom route + payment intents + Paystack |
| SPA design tokens | Light retail system exists (primary/spark/price) |
| Honest empties | Partially improved (home/PDP) |
| RBAC vertical slice | `/store/alkemart/me` + customer_role module started |

### 3.2 Critical gaps (S0–S1)

| # | Gap | Ideal | Alkemart now |
|---|-----|--------|--------------|
| 1 | Vendor portal on target stack | Medusa vendor APIs + SPA | SPA → `api-stubs` → Express only |
| 2 | Checkout vendor association | Link order↔vendors; fulfillments per vendor | Medusa completeCart has **no** vendor split/link |
| 3 | Product ownership on store path | Every product linked to vendor; sold-by | Metadata/ETL partial; no public vendor API |
| 4 | Public store page | `/store/$slug` works | **Broken code** (undefined vendor vars) |
| 5 | Settlements on Medusa | Module + UI | **Missing** |
| 6 | VendorStaff model | customer↔vendor membership | Hollow model (role text only) |
| 7 | Dual-home SPA | Single backend | Buyer Medusa / ops Express — unprofessional |
| 8 | Catalog density | Real products | Empty Express ETL / thin seed |
| 9 | RBAC complete | Assign/revoke + server guards on all privileged routes | Me + buyer default only |
| 10 | Redis / outbox | Multi-instance safe | Fake redis; EventEmitter on Express |

### 3.3 Workflow matrix (condensed)

| Workflow | Buyer | Vendor | Admin |
|----------|-------|--------|-------|
| Catalog | Medusa partial | — | — |
| Vendor storefront | **Broken** | — | — |
| Cart/checkout | Medusa Ghana path | — | — |
| Products/fulfill | — | **Stubs** | — |
| Settlements | — | No UI | Express only / no SPA |
| Roles | Signup buyer | Manual | Express admin users / bootstrap |
| Messaging/disputes | Stubs | Stubs | Stubs |

---

## 4. UI/UX deep diagnosis

### 4.1 Overall judgment

The SPA has **competent engineering bones** (tokens, some honest empties, MoMo thinking) but **reads as a migration prototype**, not a shippable marketplace:

- Broken routes and dual API make the product feel “dead”  
- Walmart-shaped chrome/lexicon without US density or Ghana brand clarity  
- Theater UI: steppers that don’t advance, fulfillment that looks choosable but isn’t, empty notifications  
- Trust signals incomplete (sold-by, free shipping claims, error vs empty)

### 4.2 Severity list (treatment order)

**P0 — fix or hide before any demo claiming “marketplace”**

1. Repair `/store/$slug` (vendor by slug + filtered products) or remove nav to it  
2. Dual-home: either restore intentional Express dual-home for ops **with clear env**, or **hide** vendor/admin menus when stubs fail; never show empty shells as live  
3. Notification bell: fix types or remove until backend exists  

**P1 — trust & conversion**

4. Separate API error vs empty on PLP/home (retry)  
5. Sold-by on every card (API must return vendor)  
6. Checkout: real stepper; remove false “Ships free” unless true  
7. Wire or remove location/fulfillment theater  
8. Cart error states; promo apply feedback  
9. Lists: product cards not “product #id”  
10. Homepage: CMS or curated non-empty merch  

**P2 — de-Walmart / polish**

11. Replace Rollback / Registry / Reorder language with Ghana marketplace voice  
12. Feedback FAB: implement or remove  
13. Footer depth (Sell with us, help, legal)  
14. Brand decision: True Blue chrome vs yellow-primary — pick one, document  

**P3**

15. Tokens for magic numbers; unused fonts; dark mode decision  

### 4.3 Design system treatment

| Action | Detail |
|--------|--------|
| Brand brief | Ghana marketplace: trust blue + accent yellow for CTAs only (or inverse — document) |
| Type | Use one display + one body; drop unused packages or use them consistently |
| Components | Ban raw `<button>` in account; use `Button`; fix nested interactive on product cards |
| Empty states | Illustration + primary CTA + secondary help — same component everywhere |
| Motion | Subtle only; no carousel theater without products |

---

## 5. Recommended operating model (how to close gaps without thrashing)

### Phase 0 — Honesty gate (1–3 days)

- Feature-flag or hide vendor/admin/support if backend path is stub  
- Fix or unroute broken store page  
- Document dual-home explicitly in env (`VITE_OPS_BACKEND=express|medusa|off`)

### Phase 1 — RBAC complete (in progress)

- Assign/revoke roles, server guards on all privileged custom routes  
- Vendor role ↔ marketplace vendor_id  

### Phase 2 — Marketplace core on Medusa

- Vendor APIs: shop, products, orders, fulfillment  
- Checkout: vendor-product graph → per-vendor fulfillments **or** split orders  
- Public store + sold-by on list/PDP  
- SPA off `api-stubs` for those surfaces  

### Phase 3 — Money & ops

- Settlements module port + SPA UI  
- Paystack Transfer later  
- Disputes/cancel on Medusa  

### Phase 4 — UX system pass

- Brand + chrome + PLP/home merch density  
- Error/empty/loading system  
- Accessibility pass  

### Phase 5 — Role-based E2E (headed browser)

Only after Phases 1–2: buyer / vendor / support / admin matrix with screenshots.

---

## 6. Neon decision recap

| Question | Answer |
|----------|--------|
| Keep Neon? | **Yes** |
| Why? | Managed Postgres, branching for migration, fits Medusa |
| Risks? | Cold start, pooling misconfig, dual DB during cutover |
| Mitigations | Pooled URLs, warm prod compute, ADR-P1 separate DBs, Redis/outbox for non-DB concerns |

---

## 7. References

- Medusa marketplace recipe: https://docs.medusajs.com/resources/recipes/marketplace  
- Alkemart commercial spine: `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md`  
- Neon layout: `docs/architecture/2026-07-15-neon-database-layout.md`  
- UX intent: `docs/superpowers/specs/2026-07-13-walmart-multivendor-ux.md`  
- RBAC slice: `docs/architecture/2026-07-16-alkemart-rbac.md`  
- Express port inventory: `docs/architecture/express-port-inventory.md`  

---

## 8. Bottom line

Alkemart is **halfway through a hard migration**: Express already encodes a real multi-vendor pilot; Medusa has commerce + Ghana payments foundation but **marketplace operations and SPA professionalism have not landed**. Neon is **not the problem** — **incomplete marketplace workflows + dual-homed/broken UI** are.

Treat the product as:

1. **Platform commerce** (Medusa catalog/cart/order/pay)  
2. **Marketplace economics** (vendor ownership, fulfillment split, settlement)  
3. **Trust UI** (sold-by, honest states, one backend, Ghana brand)  

Ship in that order. Do not expand E2E theater until P0 UI and vendor association exist.
