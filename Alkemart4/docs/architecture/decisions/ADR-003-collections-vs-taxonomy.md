# ADR-003 — Vendor collections vs platform taxonomy

**Status:** accepted · **Date:** 2026-09-21 · **Roadmap:** Phase 0 → implemented in Phase 4A

## Context

Sellers need own-language merchandising ("Student phones"); the platform needs
governed classification. Overloading one tree serves neither (blueprint Doc 02).

## Decision

- Classification/navigation/attribute-profile/search-vocabulary/campaign-placement
  are platform-owned. Collections are seller-owned, many-to-many with products,
  with draft/published visibility, ordering, art, optional schedules.
- Collections never alter canonical classification, facets, or comparison.
- Public collection routes are eligibility-filtered (in-stock, in-policy,
  live-seller only).

## Consequences

- New `collections` + `collection_products` tables (Phase 4A); shop-featured
  maps onto collections with a compat reader.
- Indexable only when curated, stable, non-empty (Phase 6).

## Rollback

Hide collections UI; featured reader restores prior shelves.
