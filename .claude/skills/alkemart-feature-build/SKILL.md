---
name: alkemart-feature-build
description: The end-to-end recipe for building an alkemart feature the "agnostic, trust-by-default" way — domain rules, API (memory + Postgres), migrations, UI, sandbox proof, docs. Use when starting any new pilot phase or feature.
---

# Building an alkemart feature

The order that worked for pilot phases 1–2 (`docs/architecture/workers/PILOT-PLAN.md`).

## 0. Direction

- **Trust by default.** Sellers are known shops; don't add admin approval gates
  to everyday actions. Give evidence that speeds things up (e.g. the buyer's code
  releases a payout at once) and a report path for exceptions. Admin only
  resolves what buyer and seller can't settle.
- **Timings fit reality.** Orders can complete in hours; windows scale with the
  order (same-day vs multi-day).
- **Agnostic:** the rule lives once in `packages/domain`, the API computes, and the
  apps only display. Tunable numbers get domain defaults plus an admin-editable
  policy in `platform_settings` (see `DeliveryPolicy`, `admin → Rules`).
- Plan briefly first, and write the plan into `PILOT-PLAN.md` if it's a new phase.

## 1. Domain (`packages/domain/src/*.ts`)

- Pure functions, money as `bigint` minor units, time in the market's clock
  (`resolveMarket().utcOffsetMinutes`).
- Plain-language error classes (e.g. `BusinessRangeError`), mapped to 400 in the API.
- Export from `src/index.ts`; tests in `src/__tests__/`, including edge cases
  (bias, boundaries, wrong input).

## 2. Data

- Hand-written, idempotent migration `packages/db/src/migrations/00NN_name.sql`
  (`ADD COLUMN IF NOT EXISTS`, constraints in `DO $$ … duplicate_object`), plus
  the drizzle schema and its export in `schema/index.ts`. Then run
  `bun scripts/check-migrations.ts`.
- Anything frozen at checkout (fees, choices, promises) is stored on the intent
  and order. Never recompute history from current settings.
- Repository methods go in **both** `InMemoryCheckoutRepository` and
  `PostgresCheckoutRepository`, with identical semantics. In-memory uses
  `this.now()` so tests can move the clock.

## 3. API (`apps/api/src`)

- Route file per area; mount in `index.ts` with the right `withBind(...)`.
  Stores are bound lazily (`settings`, `statements`… in `bindCheckout`).
- Prices, fees and eligibility are computed server-side, never taken from the client.
- The seller never sees buyer secrets (e.g. the handover code); buyer contact
  details never go into exports.
- Rate-limit new public writes (`middleware/security.ts`); audit-log admin changes.
- Tests: route-level with `createApp({...in-memory stores})`. Update old tests when
  behaviour changes intentionally; say so in the report.

## 4. UI

Follow the `alkemart-ui-ux` skill. Shared pieces go in `packages/console-ui`
(vendor + admin) or `packages/maps`; don't copy components between apps.

## 5. Prove it

Follow the `alkemart-sandbox-verify` skill: walk the real flow on every surface it
touches (buyer, seller, admin), at desktop and phone width. Fix what you find;
it usually finds real bugs (e.g. the fee-only save that wiped seller settings).

## 6. Record

- Update the lifecycle doc(s) (`LIFECYCLE-BUYER/VENDOR/ADMIN/PAYMENT.md`), add a
  `BUILD-LOG.md` section and the migrations-table row, and mark the phase in
  `PILOT-PLAN.md`.
- Report to the owner in plain words: what they can now do, what was proven,
  what needs them (e.g. "apply migration 00NN"), and what's next.
- Don't commit or push unless asked; stay on `main`.
