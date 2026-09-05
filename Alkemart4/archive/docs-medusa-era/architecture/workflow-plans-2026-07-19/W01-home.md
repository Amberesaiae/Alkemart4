# W01 — Home discovery

## 1. Audit (as-built)

| Item | Detail |
|------|--------|
| **Route** | `/` → `routes/index.tsx` |
| **UI** | Mosaic (4 photo tiles) → Last Offers (hero/feature/row/tile) → How-it-works → Delivery → Advertise |
| **Data** | `listStoreProducts` + `listStoreCategories` + `resolveHomeProducts` / mosaic seed |
| **Screenshot** | [screens/01-home.png](./screens/01-home.png) |
| **Mowafer ref** | Web imgi_10; mobile imgi_12 home |

### Observed (screenshot)

- Text logo, rail icon\|label, photo mosaic, asymmetric Last Offers, gold stars, cart ICONPAK2.
- Demo + real products mixed; board hierarchy locked for first 6 demo slots.

## 2. Inconsistencies / gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Demo thumbnails vs photography | Med | Pixel art on hero when no real media |
| Catalog without server price | Med | Dual fetch hydrate |
| `category_label` often missing on live | Low | Demo has labels |
| How-it-works not in Mowafer imgi_10 | Low | Extra Ghana education — OK if short |
| Home demo ON in dev | High if prod | Must be off for money path |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Server card incomplete (price/label) | Demo hierarchy complexity OK for sparse catalogs |
| | Avoid more home sections before catalog truth |

## 4. Plan

| Pri | Task | Surface |
|-----|------|---------|
| P1 | Catalog returns `min_price` + `category_label` server-side | API |
| P1 | Disable `VITE_HOME_DEMO` in production env assert | Storefront env |
| P2 | Prefer real product media over demo glyphs when available | Seed merge |
| P3 | Optional “Deals of the Day” rail only if data exists | FE |

## 5. Reevaluation gate

- [ ] Home loads with ≥1 ATC-capable offer when catalog non-empty  
- [ ] No demo cards when `HOME_DEMO=0`  
- [ ] Hierarchy still readable on 1280 and 375 widths  
- [ ] Re-screenshot `01-home.png` matches SPINE order  
