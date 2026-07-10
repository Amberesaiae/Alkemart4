---
name: Alkemart admin/vendor analytics endpoints
description: Where marketplace analytics aggregates live and the revenue-counting rule they follow.
---

`GET /admin/analytics` and `GET /vendor/analytics` (added for the admin/vendor sidebar dashboards) compute all metrics on the fly via SQL aggregation over `orders`/`orderItems`/`fulfillments`/`disputes`/`products` — there is no separate analytics/reporting table or cache.

**Why:** the task scope explicitly excluded building a general-purpose reporting system; existing list endpoints/tables were sufficient for the requested charts.

**How to apply:** revenue in both endpoints only counts orders with status `confirmed` or `fulfilled` (never `pending`/`cancelled`) — keep this consistent if adding more revenue-based metrics. `/vendor/analytics` scopes every query by `vendorIdsFor(req.user.roles)`; any new vendor-facing aggregate must do the same or it leaks cross-vendor data.
