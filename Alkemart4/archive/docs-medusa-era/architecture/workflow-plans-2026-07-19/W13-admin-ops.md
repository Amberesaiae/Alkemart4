# W13 — Admin moderation (Mercur)

## 1. Audit

| Item | Detail |
|------|--------|
| **Surface** | `:9000/dashboard` |
| **Alkemart** | Read queues: sellers/products/summary; stats; reindex |
| **Mutations** | Mercur approve/suspend/confirm/reject |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Flat admin power (any user = reindex+GMV) | Med for v1 |
| Explicit middleware missing on stats/reindex | Low (framework covers) |
| Lab credentials culture | High if reused |

## 3. Engineering balance

| Under | Over |
|-------|------|
| No support_agent split | Don’t invent IAM product day-1 |

## 4. Plan

| Pri | Task |
|-----|------|
| P0 | Explicit `authenticate("user")` on all `/admin/alkemart/*` + reindex POST |
| P1 | Runbook: approve seller + product without seed inject |
| P2 | Audit log reindex |
| P3 | Optional support role later |

## 5. Reevaluation gate

- [ ] Seller JWT → moderation 401  
- [ ] Admin can clear pending queue  
- [ ] Product appears sellable after confirm  
