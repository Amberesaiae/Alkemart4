# W14 — Search index + sellable recompute

## 1. Audit

| Item | Detail |
|------|--------|
| **Engine** | Meilisearch optional |
| **Docs** | `lib/search/documents.ts`, sellable evaluation |
| **Types** | `seller_city` / `seller_province` **additive** (not populated yet) |

## 2. Gaps

| Gap | Severity |
|-----|----------|
| Location fields not indexed | Blocks W02 location enable |
| Sellable vs published divergence (KD-15) | Med |
| Reindex admin-only but heavy | Med |

## 3. Engineering balance

| Under | Over |
|-------|------|
| Location not indexed | Don’t build multi-region geo shards |

## 4. Plan

| Pri | Task |
|-----|------|
| P1 | Populate seller city/province from seller address on index |
| P1 | Facet filter wiring in search service |
| P2 | Catalog list filter=sellable option for SPA flag |
| P2 | Reindex rate limit |

## 5. Reevaluation gate

- [ ] Document with Accra seller found via city filter  
- [ ] Location control `locationEnabled=true` in staging  
