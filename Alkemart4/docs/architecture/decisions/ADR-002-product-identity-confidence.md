# ADR-002 — Product identity confidence (A/B/C)

**Status:** accepted · **Date:** 2026-09-21 · **Roadmap:** Phase 0 → implemented in Phase 1B

## Context

Branded goods are the intended merchandise, but GTIN/MPN are not universally
available at onboarding (blueprint Doc 02). Two failure modes bracket us:
excluding valid retailers vs falsely merging similar products.

## Decision

- `products.identityConfidence`: `identified` (brand+model confirmed, GTIN/MPN
  when available) | `matched` (rule/similarity proposal confirmed by
  seller/admin review) | `seller_specific` (standalone, enrichment queue).
- Only reviewed transitions promote to `matched`. No auto-merge without
  reviewed evidence. Merge history is immutable (`product_match_candidates`).
- Exact peer-offer comparison renders only for `identified`/`matched`.
  `seller_specific` products are fully buyable but carry no comparison claims.

## Consequences

- Phase 1B schema + Phase 3 peer API gate on this field.
- PDP copy branches on confidence (comparison vs standalone).

## Rollback

New field defaults to `seller_specific` (conservative); dropping the column
restores today's always-ungated behavior — not permitted once Phase 3 ships.
