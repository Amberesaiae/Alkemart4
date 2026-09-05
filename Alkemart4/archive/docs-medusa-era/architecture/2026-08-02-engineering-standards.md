# Engineering Standards — Backend-First Principles & Frontend Practices

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — binding for all contributors (human and agent) |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |

---

## 1. Backend-First Principles

The backend is the **single source of truth**. Frontends render state; they never invent it.

### P1 — No facade code
Every UI action calls a real endpoint doing real work. If the capability doesn't exist, the UI element doesn't ship. A disabled button with intent is honest; a mocked success is a defect.

### P2 — Fail loudly
No silent fallbacks. Errors propagate to the route boundary, return honest HTTP codes (`CheckoutHttpError` pattern), and surface as toasts. **Sole exception:** subscribers are best-effort (logged, swallowed) because notifications must never break commerce.

### P3 — Server-side authority
Seller scoping, state transitions, and money math are enforced in the API. Frontend checks are UX sugar. The client **never** passes `seller_id`; scope is resolved from auth context. Regression net: `e2e` RBAC + isolation suites.

### P4 — Thin routes
`route.ts` = parse → validate → authorize → delegate to `lib/` or a module service. Business logic in a route file is a smell; extract it.

### P5 — One canonical home per concept
| Concept | Home |
|---|---|
| Ghana constants (regions, phone, currency, tax, payment) | `@alkemart/shared/ghana` |
| Country canon + phone normalization | `packages/api/src/lib/operating-markets.ts` |
| Checkout | `lib/ghana-checkout.ts` |
| Paystack HTTP | `lib/paystack-client.ts` + `src/modules/paystack*` |
| Sellability | `lib/product-sellable.ts` |

Frontends re-export/wrap — never re-declare. A client-side mirror of backend logic must name the function it mirrors in a comment.

### P6 — Metadata keys are documented contracts
Sanctioned keys live in the lifecycle docs (seller: `commission_bps`, `delivery_fee_ghs`; return: `payment_id`, `payment_status`, `is_disputed`, `dispute_*`, `resolution*`). Adding a key ⇒ update the doc in the same PR. Undocumented metadata is tech debt.

### P7 — Money discipline
Integer pesewas everywhere; rates in bps; conversion at the display edge only (`formatGHS`, `pesewasToMajor`). Never float arithmetic on money.

### P8 — Migrations forward-only
Through Medusa/Mercur tooling against Neon (`scripts/backend-migrate.ts`); test on a Neon branch first. Never hand-edit production schema (see database skill flow for prod).

### P9 — Security defaults
New public GET ⇒ `rateLimit`. New panel namespace ⇒ `securityHeaders`. New session mutation ⇒ CSRF. Auth surfaces ⇒ `authRateLimit`. Debug/migration routes ⇒ hard production gate (`NODE_ENV === "production"` → 403) **plus** secret check. Sensitive admin actions ⇒ `lib/audit-log.ts`.

### P10 — Async work off the request path
Subscribers flag; jobs process (images, reindex, TTL sweeps). Nothing heavy inline. Every cache names its invalidation trigger.

---

## 2. Frontend Practices (all three apps)

### F1 — Stack uniformity
React 19 + Vite + TanStack Router (file-based) + TanStack Query + Tailwind v4 + `@workspace/ui` + sonner. No second state library, router pattern, or toast system.

### F2 — Three-layer data access
```
routes/ (components)  →  hooks/ (TanStack Query: keys, invalidation, toasts)  →  lib/api.ts (the ONLY fetch layer)
```
- `api.ts` organized by domain namespace (`adminSellers`, `adminReturns`, `orders`, …); response types declared beside it.
- No raw `fetch` in components. No query keys constructed in components.

### F3 — Mutation shape
Await → toast → invalidate/refetch. No optimistic updates without a documented exception. Destructive actions (terminate, refund, cancel) confirm via modal that states the consequence.

### F4 — Base paths & ports are contracts
| App | Base | Dev port |
|---|---|---|
| storefront | `/` | 5175 |
| admin | `/dashboard/` | 3001 |
| ghana-vendor | `/seller/` | 3002 |

Vite `base`, dev port, workflow config, and proxy mapping move in lockstep (the 7002 drift broke preview once — don't repeat it).

### F5 — Type honesty at boundaries
`unknown` metadata is narrowed explicitly (`String(...)`, ternaries) — never `any`, never `unknown` rendered as JSX. All apps must pass `tsc --noEmit`. Task #8 will generate shared request/response types from the backend; until then hand-declared types live next to `api.ts`.

### F6 — Ghana-first UX
SMS-grade copy; MoMo prefix validation with provider auto-detect (mirroring backend normalizer); GhanaPost GPS addresses; GHS via shared formatters; low-bandwidth budgets (code-split heavy routes — task #15).

### F7 — Toaster placement
`<Toaster richColors position="top-center" />` mounts once in `routes/__root.tsx` — never inside layout components (esbuild dep-scan broke on that once).

---

## 3. Definition of Done (any feature)

1. Endpoint real, scoped, validated — no mocks
2. UI wired through hooks with toast + invalidation
3. `tsc --noEmit` clean in every touched package
4. Production build passes (`bun run build`)
5. Docs updated if a lifecycle/metadata/port contract changed
6. Committed + pushed to `origin/main` (Railway/Vercel deploy from remote)
7. Live click-through on the deployed stack for money-touching flows

## 4. Verification Commands

| Gate | Command |
|---|---|
| Types | `bunx tsc --noEmit` (per app/package) |
| Build | `bun run build` |
| Backend unit | `bun test` in `packages/api` |
| Storefront unit | `vitest run` |
| E2E | `e2e/` Playwright suites (checkout, refund, RBAC, isolation, onboarding) |
| Load | `k6/` |
