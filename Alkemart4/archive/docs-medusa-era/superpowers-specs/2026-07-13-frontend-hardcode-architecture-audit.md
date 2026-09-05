# Frontend architecture & hardcoding audit

**Date:** 2026-07-13  
**Scope:** `artifacts/alkemart` buyer/vendor/admin UI  
**Method:** Explore-agent full codebase pass + grep inventory

## Architecture map

```
main.tsx → router (QueryClient + TanStack file routes)
  __root          error/not-found shell
  signin*         auth (no shop chrome)
  _shop           SiteHeader + Outlet + Footer
    /             HomepageSectionList (API sections)
    /browse/$slug PLP
    /ip/$id       PDP
    /store/$slug  vendor storefront
    cart|checkout|orders|account*
    vendor/* | admin/*
```

| Layer | Role |
|-------|------|
| `components/ui` | Design-system primitives (token-aware) |
| `components/shop` | Marketplace domain (chrome, cards, homepage) |
| `components/discover` | **Orphaned** editorial search (dead code) |
| `lib/*` | auth, themes, homepage config schemas |
| `@workspace/api-client-react` | Orval hooks — real commerce API |

## Severity summary

| Severity | Count (approx) | Theme |
|----------|----------------|-------|
| Critical | 7 areas | Fake commerce, mock PDP, inert filters, dead CTAs |
| Major | 15+ areas | Static chrome, CMS gaps, shell inconsistency |
| Minor | many | Magic numbers, GH₵ helpers, hex on logo |

See full inventory in conversation / remediation below.

## P0 remediation (executed)

1. Product rails: no seed products in production — skeleton/empty only  
2. Empty homepage: no priced placeholders  
3. Shared `lib/money.ts` + `lib/commerce-content.ts`  
4. Deleted orphan `components/discover/*`  
5. Section header via `MerchLink`  
6. Departments: prefer categories API with content fallback  
7. **PDP strip** — Chromebook mock removed; not-found + API-only sections  
8. **Merch CTAs** — `ctaTo` on hero/announcement/bento/hero-split schemas + components  
9. Video grid: honest empty (no fake handles/prices)  

## API gaps forcing hardcode

- List `Product` has no `vendor` (only detail does)  
- No facets, reviews, variants, FBT, trending search endpoints  
- Homepage bento/video configs lack item arrays in renderer  
