# W15 — RBAC cross-actor matrix

## 1. Audit

| Item | Detail |
|------|--------|
| **Full audit** | `../2026-07-19-rbac-workflow-production-audit.md` |
| **E2E** | `e2e/tests/rbac-multivendor.live.spec.ts` |
| **SPA ACCESS** | `apps/storefront/docs/ACCESS-AND-RBAC.md` |

## 2. Current matrix (summary)

| Op | Guest | Buyer | Seller | Admin |
|----|-------|-------|--------|-------|
| Catalog | ✓ | ✓ | — | — |
| ATC / cart | ✓ | ✓ | — | — |
| Checkout COD | ✓ | ✓ (unbound) | — | — |
| `/me` | ✗ | ✓ | ✗ | ✗ |
| Vendor propose | ✗ | ✗ | own | — |
| Admin moderate | ✗ | ✗ | ✗ | ✓ |
| metadata.roles escalate | n/a | **no effect** (sanitized) | ✗ | — |

## 3. Gaps still open

See master audit C2–C4, H1–H8.  
P0 partially done: guest orders UI, roles sanitize, prod kill-switch refuse, stale docs.

## 4. Plan

Execute master audit §7 P0–P3 in order.  
Do **not** reintroduce CASL into SPA.

## 5. Reevaluation gate

Full production test script in master audit §8 — all boxes green.

## 6. Verbosity / over-engineering cuts

| Cut | Why |
|-----|-----|
| No SPA role matrix UI | Wrong actor |
| No customer_role table until real product need | Avoid phantom SoT |
| No dual admin in storefront | Dual-home failure mode |
| Keep soft gates as pure functions | Testable without IAM product |
