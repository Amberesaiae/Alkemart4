# ADR-001 — Product → Variant → Offer with `offerId` cart binding

**Status:** accepted · **Date:** 2026-09-21 · **Roadmap:** Phase 0

## Context

Blueprint Doc 02 defines Product (shared identity) → Variant (buyer-selectable
variation) → Offer (seller-specific terms). The repo already implements
`products / productVariants / offers` with ATC binding `offerId`.

## Decision

- Product holds identity + shared descriptive truth only. Price/stock live on
  offers, never on products.
- Add-to-cart binds `offerId` only. Checkout creates a payment intent, then an
  OrderGroup with per-seller orders.
- Amounts are integer pesewas end-to-end (DB `bigint` → domain → API → UI).

## Consequences

- PDP must resolve exactly one active offer (one price owner); peer selection
  switches offer identity atomically (Phase 3).
- Variant-only or product-only cart lines are rejected defects, not edge cases.
- Schema changes in Phases 1/3 extend this model; they never fork it.

## Rollback

N/A (restatement of built doctrine). Reopening requires a superseding ADR.
