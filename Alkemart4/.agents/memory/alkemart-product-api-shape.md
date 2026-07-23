---
name: Alkemart Product API shape gotchas
description: Fields the Product/ListProducts API does NOT have, which trips up sort/filter UI work.
---

- `ListProductsParams` has no `sort` param — any sort-by UI must sort client-side over the fetched page.
- `Product` has no `createdAt` field — approximate "newest first" via descending `id` (serial PK), not a date field.
- `Product.tag` is a nullable free-form string matching the enum used by `DealTag` (`rollback`/`clearance`/`best`/`popular`/`new`); homepage deal rails should fetch via `useListProducts({ tag })` per tag rather than hardcoding seed prices.

**Why:** discovered while wiring browse/search sort+pagination and homepage deal columns to real data (e2e-verified) — TypeScript alone won't catch a sort/date field that was assumed to exist.
**How to apply:** before adding new Product-derived UI (sorting, "new arrivals", date display), check `lib/api-spec/openapi.yaml`'s `Product` schema first rather than assuming REST/e-commerce conventions.
