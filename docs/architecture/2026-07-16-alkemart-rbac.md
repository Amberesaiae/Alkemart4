# Alkemart RBAC — SUPERSEDED

| Field | Value |
|-------|--------|
| **Date** | 2026-07-16 (original) · **superseded 2026-07-19** |
| **Status** | **OBSOLETE** — do not use for production security review |

## Why this doc is wrong

The original draft assumed:

- Express dual-home stack + CASL `@workspace/abilities`
- Medusa `customer_role` table as SoT
- SPA `useGetMe` + role matrix for staff UI

**None of that is live.** Clean-slate architecture is:

| Surface | Actor | App |
|---------|--------|-----|
| Buyer | `customer` (or guest) | `apps/storefront` |
| Seller | `member` + `x-seller-id` | Mercur `/seller` |
| Admin | `user` | Mercur `/dashboard` |

Customer `metadata.roles` is **not** authorization (and is now ignored by `/store/alkemart/me`).

## Read instead

1. **`docs/architecture/2026-07-19-rbac-workflow-production-audit.md`** — full production audit + fix plan  
2. **`docs/architecture/2026-07-16-ops-rbac-surfaces.md`** — three-door ops principle  
3. **`apps/storefront/docs/ACCESS-AND-RBAC.md`** — buyer SPA contract  
4. **`e2e/tests/rbac-multivendor.live.spec.ts`** — live actor isolation tests  
