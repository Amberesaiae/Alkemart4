# W08 — Orders (guest lookup + account list)

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/orders`, `/order/$id` |
| **Screenshot** | [08-orders-guest.png](./screens/08-orders-guest.png) |
| **P0 fix** | Removed `requireAuth` wall on `/orders` (2026-07-19) |
| **P1 fix** | Email+id server lookup + FE gate (2026-07-19) |

### Observed

- Guest can open Track orders + paste id **and email**  
- Account list only when session present  
- Order detail: JWT owner retrieve **or** POST `/store/alkemart/orders/lookup`  
- Checkout confirmation passes `email` search param  

## 2. Remaining gaps

| Gap | Severity |
|-----|----------|
| Order retrieve IDOR vs guest 401 | **Fixed P1** — email match required for guest |
| Account list empty after guest-then-login checkout | Mitigated by W06 bind when signed-in at checkout |
| No signed magic-link token | P2 optional |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Email is shared-secret strength | Don’t build full returns/disputes portal |

## 4. Plan

| Pri | Task | Status |
|-----|------|--------|
| **P1** | Server order policy: owner JWT **or** (email + id) | **Done** |
| **P1** | FE: email form on order detail + orders lookup | **Done** |
| **P1** | Rate-limit lookup endpoint | **Done** |
| P1 | E2E: guest open own confirmation; stranger denied | Pending e2e |
| P2 | Optional email magic link | Open |
| P2 | Order detail: hide PII until verified | Done via policy |

## 5. Reevaluation gate

- [x] Guest lookup without login works (email + id)  
- [x] Wrong email / stranger id → no PII (404 same message)  
- [x] Signed-in uses Medusa order retrieve first  
- [ ] Re-screenshot `08-orders-guest.png`  
- [ ] E2E automation green  

**P1 implementation complete (2026-07-19).**
