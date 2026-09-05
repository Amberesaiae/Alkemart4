# W03 — Search

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/search` (+ header form) |
| **Data** | `POST /store/search` → Meili; fallback `product.list?q=` |
| **Screenshot** | [04-search.png](./screens/04-search.png) |
| **Facets** | category_handles, seller_handles |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Meili hits have **no offer_id** → no ATC until PDP | **High** |
| Empty query / empty engine UX | Med |
| No location filters applied | Med (types ready) |
| Facet UI incomplete vs Meili distribution | Med |

## 3. Engineering balance

| Under | Over |
|-------|------|
| offer_id join missing | Don’t build Elasticsearch abstraction |

## 4. Plan

| Pri | Task |
|-----|------|
| P1 | Index `offer_id` / `has_offer` + return on hits **or** batch enrich ATC |
| P1 | Pass `seller_province`/`seller_city` when enabled |
| P2 | Empty state + “search disabled” copy when engine=disabled |
| P2 | E2E: search → card → PDP → ATC |

## 5. Reevaluation gate

- [ ] Search result with sellable product can ATC from card **or** one-click PDP  
- [ ] Facets filter results  
- [ ] Re-screenshot `04-search.png`  
