# W10 — Sellers index + seller store

## 1. Audit

| Item | Detail |
|------|--------|
| **Routes** | `/sellers`, `/store/$slug` |
| **Screenshot** | [09-sellers.png](./screens/09-sellers.png) |
| **Store** | Multi-category **sections** when `categoryLabel` present |
| **P1** | Server catalog filter `?seller_handle=` (2026-07-19) |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Store products = client filter of global list | **Fixed P1** — `listStoreProducts({ sellerHandle })` |
| No server `seller_handle` catalog query | **Fixed P1** — catalog route |
| Derived category chips empty without labels | Med (needs taxonomy on products) |
| Vendor list incomplete if no open sellers | OK empty state |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Client filter brittle | Don’t build full CMS store builder |

## 4. Plan

| Pri | Task | Status |
|-----|------|--------|
| **P1** | `GET /store/alkemart/catalog?seller_handle=` | **Done** |
| **P1** | Catalog returns `category_label` + seller handle | **Done** |
| **P1** | Store page uses server list only | **Done** |
| P2 | Vendor payload: derived `category_names[]` | Open |
| P2 | Section sort by sales/name | Open |

## 5. Reevaluation gate

- [x] Store page queries catalog by seller handle (no client invent)  
- [x] Catalog API filters open sellers + published products  
- [ ] Multi-dept seller shows ≥2 sections when products labeled  
- [ ] Screenshot store page  

**P1 catalog/store filter complete (2026-07-19).**
