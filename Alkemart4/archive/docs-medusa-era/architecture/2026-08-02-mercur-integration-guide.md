# Mercur Integration Guide

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — as-built |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |
| **Packages** | `@mercurjs/core`, `@mercurjs/types`, `@mercurjs/cli` |

---

## 1. Posture: Dependency, Not Fork

Mercur is consumed as npm packages configured in `medusa-config.ts`. **Never patch `node_modules/@mercurjs`.** Extension points, in order of preference:

1. Custom API routes under `alkemart/` sub-segments (`/vendor/alkemart/*`, `/admin/alkemart/*`, `/store/alkemart/*`)
2. Custom modules (`src/modules/*`) registered as providers (e.g. `paystack-payout` inside Mercur's payout module)
3. `metadata` on Mercur/Medusa entities (documented keys only — see lifecycle docs)
4. Subscribers/jobs reacting to Mercur events
5. ADR in `docs/architecture/` if none of the above suffices

## 2. What Mercur Provides (used here)

| Capability | Module / entity | Notes |
|---|---|---|
| Seller + Member model | core entities | seller = store; member = human actor with auth identity |
| Seller statuses | `pending_approval, open, suspended, terminated` (+ `status_reason`, `approved_at`, `rejected_at`) | Alkemart derives richer phases (see seller doc) |
| Vendor API scope | `vendor-ui` module | authenticates members, resolves seller for `/vendor/*` |
| Admin scope | `admin-ui` module | platform admin actor |
| Seller↔Product link | link module | ownership of catalog entries |
| Offers | Offer entity → PriceSet + inventory_items | the sellable record per seller |
| Order splitting | OrderGroup + `order_seller` links | one cart → per-seller Orders |
| Payouts | payout module: Payout, PayoutAccount | provider-pluggable (Alkemart: Paystack transfers) |
| Commission | `Commission` entity in `@mercurjs/types` | **not yet adopted** — Alkemart uses `metadata.commission_bps` + `/admin/commission-rates` |

## 3. What Alkemart Adds on Top

| Layer | Custom pieces |
|---|---|
| Payments | `src/modules/paystack` (card + MoMo provider), `lib/ghana-checkout.ts` state machine, `/hooks/paystack` webhook, `momo-payment-ttl` job |
| Payouts | `src/modules/paystack-payout` (GH MoMo transfers), admin trigger routes |
| Onboarding | `ghana-seller-setup` (region, GhanaPost GPS, MoMo recipient), readiness gating |
| Ops routes | approve/suspend/unsuspend/terminate/commission, returns/disputes/moderation |
| Catalog UX | search index + sync subscribers, catalog cache, featured products, wishlist module, sitemap/SEO prerender |
| Notifications | SMS (AfricasTalking) / WhatsApp (Meta) / email on all lifecycles |
| UIs | all three frontends are custom TanStack apps — **Mercur's stock admin/vendor UIs are not served** |

## 4. Upgrade Playbook

1. Read Mercur changelog for entity/enum changes (seller status values, offer shape, payout API).
2. `bun install` at `apps/backend`, run migrations against a Neon branch first (`scripts/backend-migrate.ts`).
3. Grep for `@mercurjs` imports + the enums documented in the lifecycle docs; fix drift.
4. Full gate: `tsc --noEmit` (api + apps) → builds → e2e RBAC/isolation suites → deploy.

## 5. Known Divergence Risks

- **Commission duality** — `metadata.commission_bps` vs Mercur `Commission`: converge during task #10; until then bps wins.
- **Dispute-as-metadata** — Mercur has no dispute entity; if Mercur ships one, migrate flags → entity with a data migration.
- **Seller phases** — Alkemart's derived phases must be recomputed if Mercur adds statuses.
