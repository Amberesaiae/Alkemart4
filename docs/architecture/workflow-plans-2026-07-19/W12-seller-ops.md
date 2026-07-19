# W12 — Seller hub lifecycle (Mercur)

## 1. Audit

| Item | Detail |
|------|--------|
| **Surface** | `:9000/seller` (not storefront) |
| **Auth** | `member` + `x-seller-id` + ensureSeller |
| **Gates** | pending → open; setup checklist; propose quality; offers |
| **Screens** | Capture separately when backend up — not in SPA pack |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| `STRICT_PROPOSE_GATES=false` kill-switch | Critical if prod |
| Dual propose path (workflow vs updateProducts) | High |
| Drafts unlimited when incomplete | Med |
| Category optional on propose | Med |
| Multi-category product UX depends on Mercur form | Med |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Soft gates | Don’t rebuild hub in React SPA |

## 4. Plan

| Pri | Task |
|-----|------|
| P0 | Prod env refuses STRICT=false ✓ (env.ts) |
| P1 | Fail-closed offer update without seller_id |
| P1 | E2E: pending seller propose 403 |
| P2 | REQUIRE_CATEGORY_ON_PROPOSE=true post-seed |
| P2 | Unify propose with shared gate module only |

## 5. Reevaluation gate

- [ ] Lab: register → approve → setup → product → offer → storefront ATC  
- [ ] Cross-seller propose DENY  
- [ ] Incomplete setup propose DENY with checklist JSON  
