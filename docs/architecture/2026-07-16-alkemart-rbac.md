# Alkemart RBAC (Medusa path)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-16 |
| **Status** | In progress — vertical slice shipped |
| **Source of truth** | Medusa `customer_role` table via `customerRoles` module |

## Principle

Server enforces authorization. SPA CASL is for UI only.

## Roles

`buyer` | `vendor_owner` | `vendor_staff` | `admin` | `support_agent`

Shape: `{ role, vendorId }` where `vendorId` is Medusa marketplace vendor id (string) or Express integer (legacy).

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/store/alkemart/me` | customer JWT | Customer + roles from DB |
| (next) | `/admin/alkemart/roles` | admin ability | Assign/revoke — PR4 |

## Bootstrap admin

```bash
# Customer must exist (SPA signup first)
cd alkemart-medusa/apps/backend
ALKEMART_BOOTSTRAP_ADMIN_EMAIL=you@example.com npx medusa exec ./src/scripts/bootstrap-admin-role.ts
```

## SPA

- `useGetMe` / `requireAuthBeforeLoad` call `/store/alkemart/me`
- Roles normalized via `@workspace/abilities` `normalizeAuthUserRoles`

## Shared matrix

`lib/abilities/src/index.ts` — `defineAbilitiesFor`
