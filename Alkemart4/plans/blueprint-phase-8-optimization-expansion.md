# Blueprint Phase 8 — Optimization and responsible expansion

**Roadmap ref:** roadmap Phase 8. **Requires:** all prior exit gates; event
quality + sample-size discipline (Doc 10). **Lifecycle owner:** buyer + vendor.

## Goal

Improvements compound from evidence: better data → better discovery → more
qualified buyers → more seller demand → better coverage → stronger comparison.

## Slices (each independently gated — ship only when its evidence exists)

### 8A. Category/attribute-aware alternatives

- Similarity model on product type + typed attributes (Phase 1) — never
  promoted into peer-offer table; PDP "related alternatives" section only.
- Guardrails: diversity, no duplicate flooding, measured by
  `alternative_selected` → delivered order.

### 8B. Location/delivery-aware ranking

- Ranking inputs: normalized service areas, methods, pickup points, ETA bands,
  capacity, quote provenance (checkout/fulfillment hardening from gap audit
  §Checkout table ships first as its own vertical: revalidation, seller-level
  delivery, partial failure, cancellation/refund semantics).
- Delivery-area-visible-early nav (Doc 03) becomes data-backed.

### 8C. Recommendations with guardrails

- Governed recommendation service (not ad-hoc related lists): success +
  guardrails defined first per Doc 10; diversity; campaign-performance never
  overrides relevance/eligibility.

### 8D. Automated taxonomy proposals + seller interventions

- Evidence pipelines: Other-bucket review, failed-identity-match review,
  low-supply/breadth alerts, seller-language term mining → proposal queue
  (human approves; ties to Phase 1 governance queues).
- Seller quality interventions + education triggers from operational metrics.

### 8E. Department expansion + vertical exploration

- New product-commerce departments only when demand + operations justify
  (catalog/search evidence, not symmetry).
- Non-product verticals (property/jobs/services) require **separate
  architecture exploration** — never force into Product→Variant→Offer.

## Acceptance

 Each 8X slice: pre-registered success metric + guardrails, holdout reading,
 delivered-order attribution, rollback path.

## Unconstructive flags

- Recommendations before catalog quality; location ranking on unnormalized
  fee/region metadata; new departments by symmetry; jamming services/jobs into
  the retail catalog; experimenting on trust/safety meanings.
