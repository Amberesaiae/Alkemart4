# Express → Medusa port inventory

| Field | Value |
|---|---|
| **Date** | 2026-07-15 |
| **Status** | Phase 0 freeze — Express is reference, not SPA production runtime |
| **Reference code** | `artifacts/api-server/`, `lib/db/` |
| **SPA legacy callers** | `artifacts/alkemart/src/lib/api-stubs.ts` (no new callers) |

Express remains the behavioral source of truth for commercial and admin surfaces until each item below is reimplemented as Medusa modules, workflows, or custom routes. Production SPA builds must not depend on `/api` stubs.

## Port targets (Express-only capabilities)

| Capability | Express surface (indicative) | Notes |
|---|---|---|
| Checkout + quote + stock hold | `lib/checkout.ts`, checkout routes | ACID quote, hold, order create — commercial spine |
| Paystack charge / refund / verify / HMAC | `lib/paystack.ts` | Provider integration + signature verification |
| Payment intents | `lib/db` payment-intents schema + routes | Async MoMo / intent lifecycle |
| Webhooks (Paystack) | `routes/webhooks.ts` | Idempotent inbound events |
| Settlements | `routes/settlements.ts`, settlements schema | Vendor settlement generate / mark paid |
| Outbox | `lib/outbox.ts`, outbox schema | Reliable side-effects / event publish |
| Vendor CRUD / orders / analytics | `routes/vendor.ts` | Storefront vendor portal APIs |
| Admin vendors, promotions, images, homepage, disputes, users | `routes/admin.ts` | Platform admin APIs |
| Messaging / conversations | admin + support conversation routes | Inbox / support threads |
| Homepage CMS | homepage section routes + seed | Section config for storefront |
| Addresses | `routes/addresses.ts` | Partially Medusa-ready — finish under Medusa customer addresses |
| Auth password reset / forgot | `routes/auth.ts`, password-reset-tokens | Token lifecycle + email |

## SPA freeze rules

1. Do not add new imports from `api-stubs.ts`.
2. Vite `/api` proxy is **dev-only temporary** for dual-homed migration.
3. Replace each surface with Medusa SDK or custom Medusa routes; delete stubs when unused.
4. Commercial spine ADRs in `2026-07-13-alkemart-architecture-and-commercial-spine.md` remain binding during the port.
