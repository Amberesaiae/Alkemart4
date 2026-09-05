# W11 — Sell + Partners (ops entry)

## 1. Audit

| Item | Detail |
|------|--------|
| **Routes** | `/sell`, `/partners` |
| **Screenshot** | [10-sell.png](./screens/10-sell.png), [11-partners.png](./screens/11-partners.png) |
| **Behavior** | Deep links to Mercur vendor/admin — **no** SPA ops |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Env URLs empty → buttons disabled | Low (honest) |
| User confusion “where is my seller account?” | Med copy |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Marketing-only | **Correct** — do not clone seller hub in SPA |

## 4. Plan

| Pri | Task |
|-----|------|
| P0 | Keep deep-link only |
| P1 | CI assert env URLs set in staging |
| P2 | Short “how approval works” copy (pending → open) |

## 5. Reevaluation gate

- [ ] Sell CTA opens `/seller` when env set  
- [ ] Partners explains three doors without fake login into admin  
