# Alkemart agnostic approach (as built so far)

**Status:** Canonical product/engineering doctrine  
**Audience:** Humans and agents implementing the marketplace  
**Companion:** `AGENT-PLAYBOOK.md`, `ACID-DATAFLOW.md`, money ADRs in `docs/architecture/2026-07-13-alkemart-architecture-and-commercial-spine.md`

This is the **why** behind the Workers rebuild. Lifecycles and routes live in sibling files; this file is the decision spine so implementers do not re-derive Medusa/Mercur habits.

---

## 1. One-sentence doctrine

**Own the marketplace kernel** (catalog, offers, cart, payment intents, OrderGroup, fulfillment, payouts) on Cloudflare Workers + Postgres + Paystack; treat Medusa/Mercur/Express only as archaeology; keep three gold UIs as thin clients of one API.

---

## 2. What “agnostic” means here

| Dimension | Agnostic of | Locked to |
|-----------|-------------|-----------|
| Commerce engine | Medusa, Mercur, Shopify, Express dual-home | Our `packages/domain` + `apps/api` + `packages/db` |
| UI framework gravity | Mercur dashboard modules, sludge shells | Existing gold SPAs (`#FEBF31`) talking HTTP/OpenAPI |
| Money processor (Ghana v1) | Stripe-first / multi-PSP sprawl | **Paystack** MoMo + card + transfers + COD |
| Hosting ops | Long-lived Node + Redis-as-required | Workers, Pages, Hyperdrive, KV |
| Catalog identity | Variant-as-only-SKU, metadata-as-schema | **Product ≠ Offer**, ATC = `offerId` |
| Markets | Hard-coded Egypt/US assumptions | Ghana-first via `@alkemart/shared/ghana`; schema ready for `market_code` later |

Agnostic does **not** mean “any payment provider tomorrow” or “rewrite the UI every week.” It means **we do not rent our ledger or seller model from a headless commerce framework**.

---

## 3. Decisions already made (do not reopen casually)

### 3.1 Study Medusa/Mercur — leave them as runtime

- They taught vocabulary (sellers, offers, commissions) quickly.  
- They fought Accra latency, edge ops, and clean schema (metadata-as-schema, stock-location ceremony, dual writers).  
- **Archive** holds history. Active code must not dual-write.

### 3.2 Single writer

```
Store / Vendor / Admin Pages  ──HTTPS──►  Workers (Hono)  ──Hyperdrive──►  Postgres
                                              │
                                              └── Paystack webhooks / verify / transfers
```

No Express+Medusa dual-home. No “lab Medusa for writes, Workers for reads.” Lab dual-path in storefront is legacy debt to remove, not a pattern to extend.

### 3.3 Multivendor spine (non-negotiable)

1. **Product** = shared catalog identity (title, media, category).  
2. **Offer** = seller-specific price + stock + readiness.  
3. **Add to cart** binds **`offerId` only**.  
4. **Checkout** creates a **payment intent**, then an **OrderGroup** with **per-seller orders**.  
5. **Fulfillment** is seller-scoped (`ship` / `deliver`).  
6. **Payout** is admin-triggered Paystack Transfer − `commission_bps`.  
7. **Amounts** are **integer pesewas** end-to-end.

### 3.4 Commercial money invariants (from commercial spine)

These survived Express → Medusa → Workers and still bind:

1. **Charge-before-commit** for async MoMo — pending intent + stock reserve, then webhook/poll confirm.  
2. **Pesewas integers** — never float GHS in the ledger.  
3. **Webhook authenticity + idempotency** — HMAC verify; dedupe; confirm must not double-create OrderGroups.  
4. **Seller isolation** — vendor JWT cannot mutate another seller’s rows.  
5. **Honest gaps** — if returns/refunds/address book are not implemented, UI must say so (no fake success).

### 3.5 Ghana-first locale brain

`@alkemart/shared/ghana` is the single source for regions, phone/MoMo providers, currency display helpers, and Ghana address conventions. Do not fork locale constants into each SPA.

### 3.6 UX kept, contracts replaced

- Keep gold storefront / ghana-vendor / admin screens and brand `#FEBF31`.  
- Replace `@medusajs/js-sdk` with Workers HTTP (`VITE_ALKEMART_API_URL`).  
- Do **not** ship archive sludge shells or generic green OSS dashboards.

---

## 4. Topology we run today

| Concern | Choice | Notes |
|---------|--------|-------|
| API | Workers + Hono `apps/api` | `/store`, `/vendor`, `/admin`, `/hooks/paystack` |
| SoR | Supabase Postgres via **dual Hyperdrive** | `HYPERDRIVE` catalog reads; `HYPERDRIVE_PRIMARY` auth/checkout/stock/payouts |
| Cache / dedup | `CATALOG_KV` | Hot catalog + webhook event dedup |
| UIs | Cloudflare Pages (three apps) | Same API origin |
| Payments | Paystack + COD | MoMo charge, card initialize/verify, transfers |
| Search v1 | Title / `q` substring on catalog | Full-text / Meili later — not blocking kernel |
| Media uploads | Not on Workers yet | Do not fake vendor image APIs |

Live reference hosts and demo accounts: `docs/DEMO-ACCOUNTS.md`, `DEPLOYMENT.md`.

---

## 5. Domain ownership map

| Package / app | Owns |
|---------------|------|
| `packages/domain` | Quotes, password hash, payment/fulfillment/moderation transitions, payout math |
| `packages/db` | Drizzle schema + migrations |
| `packages/paystack` | Charge MoMo, initialize card, verify, transfer, recipient, webhook HMAC |
| `packages/shared` | Ghana locale + shared types |
| `apps/api` | HTTP, authz, repositories, middleware (CORS, security), confirm/idempotency |
| Storefront / vendor / admin | UX only — no ledger inventing in the client |

If a rule lives only in a React component, it is wrong. Lift it to domain/API.

---

## 6. Lifecycle map (where to read next)

| Actor / flow | Doc |
|--------------|-----|
| Browse → cart → COD/MoMo/card → orders | `LIFECYCLE-BUYER.md` |
| Register → approve → Ghana MoMo → list → fulfill | `LIFECYCLE-VENDOR.md` |
| Moderate sellers/products → orders → payouts | `LIFECYCLE-ADMIN.md` |
| Intent → reserve → webhook/poll → OrderGroup | `LIFECYCLE-PAYMENT.md` |
| Tables, txs, Hyperdrive roles | `ACID-DATAFLOW.md` |
| Every Workers-visible route / click | `NAV-MATRIX.md` |
| How an agent implements a change | `AGENT-PLAYBOOK.md` |
| Local ports / env | `LOCAL-DEV.md` |

---

## 7. Explicit non-goals (v1 / current SoR)

Do not expand scope into these unless the human re-opens them:

- Running Medusa/Mercur on Cloudflare Containers as the engine  
- Dual-write cutover theater  
- Multi-country live checkout beyond Ghana  
- External courier rate engines / label printing  
- Per-vendor partial cancel of a multi-seller OrderGroup  
- Full returns / disputes / wishlist / address-book APIs (table stubs may exist — unused)  
- Admin analytics / promotions / categories CRUD on Workers  
- Real-time chat  
- Full VAT/NHIL engine beyond documented constants  
- Browser Playwright as a launch blocker (manual nav matrix is enough for now)

---

## 8. Rejected patterns (seen in this repo — do not revive)

| Pattern | Why rejected |
|---------|--------------|
| Metadata-as-schema for money/stock | Unqueryable, untyped, breaks ACID |
| Dual Express + Medusa writers | Split brain; archive proves the cost |
| ATC by `product_id` / variant only | Breaks multi-seller offers |
| Float GHS in API | Rounding / payout bugs |
| Sync-only MoMo “success or throw” | Real Ghana MoMo is async (OTP / pending / webhook) |
| Generic green “Workers shell” UIs | Wrong brand; sludge |
| Hiding missing features behind empty success toasts | Dishonest; breaks trust |
| Agent reading `archive/**` as SoR | Contaminates implementation |

---

## 9. Honesty about “so far”

**Done enough to treat as the path**

- Workers API with store/vendor/admin mounts  
- Dual Hyperdrive + KV  
- Demo buyers/vendors/admins on Postgres  
- COD OrderGroup path + shipping address on intent  
- MoMo/card plumbing + webhook/poll verify (live money matrix still a launch gate)  
- Gold UIs on Pages with `VITE_ALKEMART_API_URL`  
- Canonical docs under `docs/architecture/workers/`  
- Medusa planning archived  

**Still debt (documented, not denied)**

- Storefront may still contain Medusa SDK dual-path code for lab builds  
- `apps/backend/packages/api` Medusa tree still in workspaces  
- Card path must reserve stock like MoMo (parity)  
- Returns / address book / wishlist / image upload gaps  
- Live Paystack money matrix + WAF + demo password rotation before public  

See `docs/ops/LAUNCH-GATE-STATUS.md`.

---

## 10. How agents apply this approach

1. Read this file once per session.  
2. Follow `AGENT-PLAYBOOK.md` steps A–D.  
3. Prefer extending `packages/domain` + `apps/api` over UI-only hacks.  
4. Never add Medusa imports or `:9000` proxies.  
5. Update the matching lifecycle doc when behavior changes.  
6. Stay on `main`; do not push unless asked.

If a request conflicts with §3 or §8, **stop and ask** — do not silently reintroduce framework gravity.
