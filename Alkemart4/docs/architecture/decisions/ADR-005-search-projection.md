# ADR-005 — Search projection via outbox; Postgres authoritative

**Status:** accepted · **Date:** 2026-09-21 · **Roadmap:** Phase 0 → implemented in Phase 2A

## Context

Browse, search, merchandising, and store routes must resolve to one catalog
truth (blueprint Doc 03). Today's `q`-substring path cannot carry faceted,
delivery-aware, trust-weighted discovery.

## Decision

- Postgres remains authoritative. Mutations to products/variants/offers/
  taxonomy/collections/sellers/reviews write an outbox row in the same tx.
- A projection consumer rebuilds search documents (identity, category,
  attributes, offer range, availability, location/delivery, seller, ranking
  signals); only published, eligible, in-policy records indexed.
- Placement of the consumer (Workers + `CATALOG_KV` vs Meilisearch) is an
  implementation choice inside this ADR's constraints; freshness SLO + failure
  dashboard are mandatory either way.
- Old `q`-substring path stays behind a flag until freshness is green for one
  full catalog cycle.

## Consequences

- New `search-outbox` table; admin freshness/failure endpoint; runbook alerts.
- Facet counts come from the projection, never browser-side JSON scans.

## Rollback

Flag off, projection paused; substring path serves traffic.
