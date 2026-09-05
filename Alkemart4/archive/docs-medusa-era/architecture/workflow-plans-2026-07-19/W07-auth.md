# W07 — Auth (login / register)

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/signin` |
| **API** | customer emailpass register/login |
| **Screenshot** | [07-signin.png](./screens/07-signin.png) |
| **Token** | JWT in **localStorage** (SDK default) |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| JWT XSS surface | High (P2 cookie hardening) |
| Cart transfer on login | **Fixed P1** — `transferLocalCartToCustomer` via Medusa `transferCart` |
| No password reset | High (P2) |
| `requireGuest` unused — signed-in can open signin | Low |
| Guest order link OK after W08 fix | OK |

## 3. Engineering balance

| Under | Over |
|-------|------|
| No reset flow | Don’t build OAuth suite day-1 |

## 4. Plan

| Pri | Task | Status |
|-----|------|--------|
| **P1** | On login: `POST /store/carts/:id/customer` (Medusa transferCart) | **Done** |
| P1 | Also transfer before checkout prep | **Done** |
| P1 | E2E guest cart → login → same items | Pending e2e |
| P2 | Password reset via Medusa/auth provider | Open |
| P2 | Prefer cookie session if XSS posture required | Open |
| P3 | requireGuest on signin when session exists | Open |

## 5. Reevaluation gate

- [x] Login calls cart transfer  
- [x] Checkout prep calls cart transfer  
- [ ] E2E: login does not lose cart  
- [ ] Logout clears session  
- [ ] Reset path documented or implemented  

**P1 cart-attach implementation complete (2026-07-19).**
