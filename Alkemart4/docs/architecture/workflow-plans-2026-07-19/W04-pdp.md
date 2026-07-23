# W04 — PDP + multi-seller (Mowafer “Other Prices”)

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/product/$id` |
| **UI** | Gallery, title, price, `SellerChip`, `ProductBuyPanel`, `PeerOffersList`, related |
| **Screenshot** | [14-pdp.png](./screens/14-pdp.png) (`/product/golden-palm-oil-1l`) |
| **Mowafer** | Mobile imgi_12 PDP + retailers list |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Peer offers via global `/store/offers?limit=100` client filter | **High** at scale |
| Related products = client re-list 48 | Med |
| Specs/reviews tabs (Mowafer) | Low (no SoR) |
| Wishlist local only | Low |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Offers API too coarse | Don’t build compare-matrix SPA day-1 |

## 4. Plan

| Pri | Task |
|-----|------|
| P1 | `GET /store/offers?product_id=` or `/store/alkemart/products/:id` aggregate |
| P1 | Related by seller server-side optional |
| P2 | Specs only if metadata attributes exist |
| P3 | Reviews module — omit UI until then |

## 5. Reevaluation gate

- [ ] ≥2 peer offers when multi-seller data exists  
- [ ] Switching offer updates ATC target  
- [ ] No invented peers  
- [ ] Re-screenshot PDP  
