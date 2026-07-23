---
name: Alkemart admin authz pattern
description: How CASL abilities map to admin route guards — support_agent vs admin split
---

# Alkemart admin route authorization pattern

## The rule
`support_agent` has `read AdminPanel` (not `manage`). This lets them enter the admin shell (vendor list, dispute queue, inbox, analytics) but blocks mutations. Admin-only mutations (e.g. `PATCH /admin/vendors/:id`) require an additional `isAdmin(req.user.roles)` check inside the handler. Support agents updating disputes is OK — that uses `requireAbility("manage", "Dispute")` which support agents have.

Route guard mapping:
- `GET /admin/vendors` → `requireAbility("read", "AdminPanel")`
- `PATCH /admin/vendors/:id` → `requireAbility("read", "AdminPanel")` + `isAdmin()` guard inside handler
- `GET /admin/disputes` → `requireAbility("read", "AdminPanel")`
- `PATCH /admin/disputes/:id` → `requireAbility("manage", "Dispute")` (support agents can manage disputes)
- `GET /admin/analytics` → `requireAbility("read", "AdminPanel")`

**Why:** Code review caught that `manage AdminPanel` for support_agent gave them access to vendor status mutation routes — privilege escalation. Split to `read AdminPanel` + inline `isAdmin()` check for mutations.

**How to apply:** Any new admin mutation route should check `isAdmin(req.user!.roles)` inline (after `requireAbility("read", "AdminPanel")`) rather than relying on `manage AdminPanel` alone. Read-only admin routes use `requireAbility("read", "AdminPanel")` only.
