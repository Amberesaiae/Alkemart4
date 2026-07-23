# Seller Hub & Admin — UI/UX rebrand + analytics

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Status** | Implemented (extension layer — no Mercur fork) |

## First principles

1. **Do not fork** `@mercurjs/admin` / `@mercurjs/vendor` — theme + extend only.  
2. **Backend remains SoR** — Admin Analytics reads `GET /admin/alkemart/stats`; Seller Analytics aggregates **vendor** list APIs (seller-scoped).  
3. **No engine names** in UI copy (Mercur/Medusa).  
4. **Yellow / black / white** brand tokens shared with storefront.

## What changed

| Surface | Change |
|---------|--------|
| Brand CSS | Thorough tokens, buttons, sidebar active state, login gradient, analytics layout |
| Login | Wordmark mark + alkemart. + Admin / Seller Hub + footer helper |
| Nav | Analytics route (rank 0), reordered Orders/Products labels |
| Orders list | Banner → Analytics |
| Seller setup | Welcome banner |
| Analytics | Recharts: KPI row, dual-axis 14d orders/GMV, status bars, catalog pie |

## Recharts practices used

- Prefer **bar + area** over 3D / rainbow pies for time series  
- **Empty states** when series is all zeros  
- **Tabular numbers**, limited color series (`#141414`, `#f5c518`, grays)  
- Tooltips with solid white cards and readable labels  
- Dual Y-axis only when units differ (orders vs GMV)  
- Seller charts **never** load platform `/admin` stats (isolation)

## Files

```
apps/backend/apps/admin/src/
  styles/alkemart-brand.css
  routes/analytics/page.tsx
  components/analytics-dashboard.tsx
  widgets/login-brand.tsx, login-footer.tsx, orders-list-banner.tsx
  _navigation.ts
  lib/chart-theme.ts

apps/backend/apps/vendor/src/
  (mirror) + lib/seller-stats.ts + seller-setup-banner
```

## Local verify

```bash
# Admin :7000 /dashboard
cd apps/backend/apps/admin && bun install && bun run dev

# Seller Hub :7001 /seller
cd apps/backend/apps/vendor && bun install && bun run dev
```

Or via API host: `http://localhost:9000/dashboard` and `/seller` after restart.

## Limits (honest)

- Deep table/column chrome still comes from the dashboard package — CSS hooks are best-effort.  
- Vendor order/offer list query params may need tuning if Mercur changes field filters.  
- Full “redesign every Medusa screen” is out of scope without forking.  
- Restart Vite panels after brand CSS changes.
