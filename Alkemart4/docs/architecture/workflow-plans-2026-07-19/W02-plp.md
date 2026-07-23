# W02 — PLP browse + filters

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/browse/$slug` |
| **UI** | Breadcrumb → `ListingHero` → `ListingFilterStrip` → sidebar Categories/Sellers → feature + tiles |
| **Screenshot** | [02-plp-pet.png](./screens/02-plp-pet.png), [03-plp-electronics.png](./screens/03-plp-electronics.png) |
| **Mowafer** | imgi_11 (pet), imgi_12 (food/electronics) |

### Observed

- Hero “Get All … From One Place!” + lifestyle art  
- Filter strip: subcat, rating, price, **location** (disabled honest), view/sort  
- Categories panel accent (magenta pet / teal electronics) via CSS themes  
- Dark sellers panel when sellers present  

## 2. Inconsistencies / gaps

| Gap | Severity |
|-----|----------|
| Location filter disabled until index | Med (honest) |
| Sub-category soft keyword match only | Med |
| Rating filter weak (no live ratings) | High if marketed |
| Nested product categories not seeded | Med |
| Feature card may show wrong-dept product if catalog sparse | Med |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Subcats not real taxonomy | 5-column strip is enough — no filter DSL |
| | Do not build faceted search UI library |

## 4. Plan

| Pri | Task | Surface |
|-----|------|---------|
| P1 | Meili + catalog: real category facets | API |
| P1 | Wire location when `seller_city` indexed | API + FE `locationEnabled` |
| P2 | Nested category seed (dept → sub) | Script |
| P2 | Drop rating filter until reviews SoR | FE honesty |
| P2 | PLP uses search as primary when Meili up | FE |

## 5. Reevaluation gate

- [ ] Pet PLP shows magenta panel; electronics teal  
- [ ] Filters that appear **change result counts** or show “no matches”  
- [ ] Location enables only with real facets  
- [ ] Screenshots re-taken for pet + electronics + food  
