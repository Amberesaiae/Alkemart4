# W06 — Checkout (Ghana COD / MoMo lab)

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/checkout`, `/checkout/pending` |
| **API** | `POST /store/ghana-checkout` — **no customer JWT required** |
| **Screenshot** | [06-checkout.png](./screens/06-checkout.png) |
| **Mowafer** | Mobile imgi_14: Address → Payment → slots → Done |

## 2. Gaps (critical for production)

| Gap | Severity |
|-----|----------|
| Checkout ignores `auth_context` — no customer bind | **Fixed P1** — `ensureCartBoundToCustomer` when JWT present |
| Guest order later hard to re-own | **Fixed P1** — email+id lookup + confirmation passes email |
| No delivery time slots | Med (P2) |
| MoMo status by cart_id open | **Fixed P1** — rate-limit 30/min per cart_id |
| Empty cart checkout UX | OK if redirected |

## 3. Engineering balance

| Under | Over |
|-------|------|
| No ownership model | Don’t build loyalty points (Mowafer) day-1 |
| No slots | Don’t invent ETAs without fulfillment windows |

## 4. Plan

| Pri | Task | Owner | Status |
|-----|------|--------|--------|
| **P1** | If Bearer customer present → set cart.customer_id before complete | API + FE | **Done** |
| **P1** | Return `order_id` + email for guest retrieve policy | API + FE | **Done** |
| **P1** | E2E: signed-in checkout → appears in `/orders` | e2e | Pending e2e |
| P1 | Rate-limit MoMo status endpoint | API | **Done** |
| P2 | Delivery slot UI only if options exist | FE | Open |
| P3 | MoMo production spine (Paystack) | Separate ADR | Open |

## 5. Reevaluation gate

- [x] Signed-in COD → cart bound to customer before complete  
- [x] Guest COD → confirmation + email handoff for lookup  
- [x] Other customer cannot read order without email proof (W08)  
- [x] MoMo status rate-limited  
- [ ] Re-screenshot checkout + success  
- [ ] E2E automation green  

**P1 implementation complete (2026-07-19).** E2E screenshot/automation remaining.
