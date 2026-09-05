# Plan 2 exit checklist — Identity + Seller Write

**Branch:** `feat/cloudflare-multivendor-plan1`  
**Date:** 2026-08-31  
**Commit:** `docs: Plan 2 identity seller exit checklist and OpenAPI`  
**Plan:** `docs/superpowers/plans/2026-08-31-cloudflare-identity-seller-plan.md`  
**Scope paths:** nested `Alkemart4/` (`packages/`, `apps/api`)

| Gate | Status | Evidence |
|---|---|---|
| Vendor register creates pending seller | ✅ | `apps/api/src/routes/store/auth.test.ts` — `vendor register / login` expects `seller.status === "pending_approval"` |
| Buyer JWT cannot access `/vendor/*` | ✅ | same file — buyer token → `GET /vendor/me` returns **403** |
| Seller A cannot mutate seller B product | ✅ | `apps/api/src/routes/vendor/products.test.ts` — seller A `PATCH` on B’s product → **404**; list isolation |
| Ghana setup stores Paystack `recipient_code` from mock | ✅ | `apps/api/src/routes/vendor/onboarding.test.ts` — mock returns `RCP_test`; seller `recipientCode` persisted |
| Missing Paystack key → 503 on ghana-setup | ✅ | same file — no `PAYSTACK_SECRET_KEY` → **503**; recipient not invented |
| No generic PaymentProvider type in repo | ✅ | `rg PaymentProvider packages apps/api` → empty (run from nested `Alkemart4/`) |
| Admin approve → seller open + product publish path | ✅ | `admin/sellers.test.ts` approve → `open`; `admin/products.test.ts` approve → `published` |

## Supporting verification (this exit)

```text
$ cd Alkemart4/apps/api && bun run test
 Test Files  8 passed (8)
      Tests  21 passed (21)

$ cd Alkemart4/packages/api-client && bun run typecheck   # exit 0
$ cd Alkemart4 && rg PaymentProvider packages apps/api    # no matches
```

## OpenAPI / client

- Spec: `packages/api-spec/openapi.yaml` v0.2.0 — store/vendor/admin auth, vendor onboarding (`recipientCode` / Paystack transfer recipient), vendor products, admin sellers + product moderation.
- Client: `@alkemart/api-client` regenerated via `bun run generate` (orval); Plan 2 operations exported from `src/index.ts`.
- **Not in this plan:** checkout charge / initialize (Plan 3). No Stripe/Flutterwave/generic multi-PSP types.

## Deferred / known minors (carry from Tasks 5–6)

- Unsuspend always → `open` even if never approved (v1 acceptable).
- Thin negative coverage for some admin routes beyond brief gates.
- Postgres catalog `moderateProduct` full-snapshot load; unconstrained seller status writes hardening.
- Live Neon migrate / wrangler smoke still credential-gated (Plan 1 carry).
