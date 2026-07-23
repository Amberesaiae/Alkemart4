# W05 — Cart multi-seller

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/cart` |
| **UI** | Lines grouped by seller, qty, remove, totals |
| **Screenshot** | [05-cart.png](./screens/05-cart.png) |
| **Auth** | Guest OK; cart_id localStorage |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| cart_id = bearer capability | High (design) |
| Seller group depends on line hydration | Med |
| Transfer on login unreliable | **Fixed P1** (W07) |
| Empty cart illustration | OK |

## 3. Engineering balance

| Under | Over |
|-------|------|
| No rate limit on cart APIs | Avoid multi-cart profiles day-1 |

## 4. Plan

| Pri | Task | Status |
|-----|------|--------|
| P1 | Cart customer attach on login | **Done** (W07) |
| P1 | Ensure cart retrieve fields always include product.seller | Partial |
| P2 | Rate-limit cart create/mutate at edge | Open |
| P2 | Multi-seller shipping preview honesty on cart | Open |

## 5. Reevaluation gate

- [ ] Multi-seller cart shows ≥2 groups when applicable  
- [x] Login transfer implemented  
- [ ] Screenshot non-empty cart  
