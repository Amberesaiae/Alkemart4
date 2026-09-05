# Workflow plan pack — 2026-07-19

**Start here:** [00-MASTER-INDEX.md](./00-MASTER-INDEX.md)

## Contents

| File | Purpose |
|------|---------|
| `00-MASTER-INDEX.md` | Catalog, dependency graph, sync score, phases |
| `W01`…`W15` | Per-workflow audit · gaps · plan · reevaluation |
| `screens/` | Live storefront captures (1280×900) |

## How reevaluation works

For each workflow after a code slice:

1. Run the **Reevaluation gate** checklist in that W-file.  
2. Replace the matching `screens/*.png`.  
3. Update **Sync score** in the master index.  
4. If a gate fails, open a task — do not mark “in sync”.

## Global references

- RBAC production audit: `../2026-07-19-rbac-workflow-production-audit.md`  
- Ghana × Mowafer system plan: `../2026-07-19-ghana-mowafer-marketplace-system-audit-and-plan.md`  
- PLP / product maps: `apps/storefront/docs/PLP_MAP.md`, `PRODUCT_CARD_MAP.md`  

## Screenshot inventory

| File | Workflow |
|------|----------|
| `01-home.png` | W01 |
| `02-plp-pet.png` | W02 |
| `03-plp-electronics.png` | W02 |
| `04-search.png` | W03 |
| `05-cart.png` | W05 |
| `06-checkout.png` | W06 |
| `07-signin.png` | W07 |
| `08-orders-guest.png` | W08 |
| `09-sellers.png` | W10 |
| `10-sell.png` | W11 |
| `11-partners.png` | W11 |
| `12-help.png` | support |
| `13-account.png` | W09 (often signin redirect if guest) |
| `14-pdp.png` | W04 |

## Priority to “everything in sync”

1. **W06 + W07 + W08** (buyer integrity) — blocks production testing  
2. **W04 + W10 + W14** (multi-seller truth + location)  
3. **W01 + W02 + W03** (catalog completeness)  
4. **W12 + W13 + W15** (ops gates + e2e matrix)  
