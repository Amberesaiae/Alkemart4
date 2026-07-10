---
name: Vendor analytics chart drill-down pattern
description: How chart-click navigation is wired between the vendor analytics overview and Orders/Products pages.
---

Recharts `<LineChart onClick>`/`<BarChart onClick>` receive `state.activePayload[0].payload` with the clicked data point. Used this to navigate:
- Revenue chart point click -> `/vendor/orders?date=YYYY-MM-DD` (date-only, sliced from the ISO timestamp the API returns) filters orders client-side by `orderCreatedAt` date.
- Top-products bar click -> `/vendor/products?highlight=<productId>` scrolls to and highlights that product's row.

**Why:** `GetVendorAnalytics` returns full ISO timestamps for `revenueSeries[].date`, not bare date strings — must slice to 10 chars before using as a filter key or it won't match `orderCreatedAt`-derived date keys.

**How to apply:** Any new drill-down from these charts should reuse TanStack Router's `validateSearch` (zod) + `Route.useSearch()` pattern already used elsewhere in the app (e.g. `_shop.admin.inbox.tsx`) rather than inventing new state plumbing.
