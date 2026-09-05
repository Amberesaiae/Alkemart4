# W09 — Account + addresses

## 1. Audit

| Item | Detail |
|------|--------|
| **Route** | `/account` (`requireAuth`) |
| **Screenshot** | [13-account.png](./screens/13-account.png) — may show signin if guest |
| **API** | customer update, addresses, markets locale |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Markets empty → weak form fields | Med |
| metadata.roles no longer trusted | Fixed on `/me` |
| Phone validation soft | Low |

## 3. Engineering balance

| Under | Over |
|-------|------|
| No GhanaPostGPS validation API | Don’t build maps geocoder day-1 |

## 4. Plan

| Pri | Task |
|-----|------|
| P1 | Ensure `/store/alkemart/markets` always returns GH locale fields in lab+prod |
| P2 | Address default selection clarity |
| P3 | Profile completeness meter (optional) |

## 5. Reevaluation gate

- [ ] Signed-in: add/edit address with region dropdown  
- [ ] Guest hitting /account → signin with redirect back  
