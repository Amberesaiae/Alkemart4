# ADR-004 — Campaign placements over arbitrary blocks

**Status:** accepted · **Date:** 2026-09-21 · **Roadmap:** Phase 0 → implemented in Phase 5

## Context

The homepage is a governed buying journey (blueprint Doc 06 course:
department → lead story → decision → product proof → shop proof → trust →
seller acquisition). Arbitrary CMS blocks let campaigns corrupt hierarchy.

## Decision

- Named placements with max-live instances + deterministic priority resolution.
- Campaign = objective + placement + product/seller sets + eligibility/terms +
  desktop+mobile creatives + schedule + tracking ID; status
  draft|review|scheduled|live|ended.
- Publication validates destination, creatives, schedule, terms, product/seller
  eligibility, conflicts, claims, tracking; failures block or warn explicitly.
- Expired/unavailable campaigns go offline automatically; every publication is
  an audit event.

## Consequences

- `placements/campaigns/creatives/product_sets/seller_sets/promotion_terms`
  tables replace `content_pages` JSON (compat reader during migration).
- Studio preview and live render share one resolver (`composeMarketCourse`
  successor).

## Rollback

Compat reader + last-known-good snapshot republish.
