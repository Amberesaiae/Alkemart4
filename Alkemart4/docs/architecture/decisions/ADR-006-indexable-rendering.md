# ADR-006 — Deterministic HTML for indexable routes

**Status:** accepted · **Date:** 2026-09-21 · **Roadmap:** Phase 0 → implemented in Phase 6B

## Context

Blueprint Doc 08 requires server rendering or deterministic prerendering for
indexable routes with correct status codes/canonicals in initial HTML. The
storefront is a Vite SPA; critical product metadata must not depend on
client-only mutation.

## Decision

- Indexable: top/valuable subcategories, canonical products, qualifying
  shops/collections, guides, policy/help. Non-indexable (noindex): account,
  cart, checkout, private pages, internal search, thin filter perms, empty
  stores/collections, duplicate campaign destinations.
- Extend the `scripts/prerender-pdp.mjs` pattern to categories/stores first;
  move to SSR only if prerender freshness fails the SLO — no framework
  migration without a new ADR.
- Removed products return successor/unavailable/410, never homepage redirect.
- Canonical product/variant URL relationship consistent across HTML, sitemap,
  internal links, feeds.

## Consequences

- Phase 6B build + validation work; Search Console/crawl-error monitoring in
  runbook.

## Rollback

Revert new routes to CSR + noindex.
