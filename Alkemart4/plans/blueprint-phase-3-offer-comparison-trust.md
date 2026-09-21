# Blueprint Phase 3 — Offer comparison and trust

**Roadmap ref:** roadmap Phase 3. **Requires:** Phase 1 identity confidence +
offer terms. **Lifecycle owner:** buyer + payment (price/stock integrity).

## Goal

For an exact product/variant, buyers compare honest total offers and switch
seller without stale price, stock, delivery, or cart state.

## Slices

### 3A. Offer terms extension

- DB: extend `packages/db/src/schema/offers.ts` — `condition`,
  `compareAtPesewas` + provenance, `fulfillmentOrigin`, `warrantyRef`,
  `returnsRef`, `deliveryPromise`, `freshnessAt`, `publishedAt`.
- Domain: `packages/domain/src/offers.ts` — compare-at provenance rule (no
  %-off without real reference), price-history append, divergence-review
  trigger (review, never auto-accusation), stale-offer suppression rule.
- API: vendor offer-terms write; store read path returns terms + price history.
- Tests: provenance-required test; stale suppression test.

### 3B. Variant-safe peer-offer API

- API: extend peer-offer endpoint consumed by `PeerOffersList.tsx` — same
  canonical product **and** variant only (confidence-gated: `identified` /
  `matched`); variant-certainty flag; delivery/total-cost computation;
  policy-difference summary; sort + explanation payload.
- Storefront `routes/product.$id.tsx`: peer selection atomically switches
  price, stock, fulfillment, seller, policies, cart identity (one active offer,
  one price owner); loading state never auto-switches selection; variant
  unavailable explains + suggests valid variants; no-offer state preserves
  info + restock/shop paths; single-offer removes comparison language.
- Tests: existing `pdp-offer-selection.test.ts` extended — atomic-switch,
  no-auto-switch-on-load, paused-seller blocks checkout.

### 3C. Total-cost ranking + explanation

- Domain: best-offer score (eligible → in-stock → total payable → delivery
  promise → reliability → returns/warranty → price); buyer sorts
  (price/delivery/trust); paid placement only as labeled sponsored, never
  silent replacement.
- UI: ranking explanation line; delivery-area eligibility check before checkout.
- Analytics: `comparison_opened`, `offer_selected`, `variant_selected`,
  `delivery_checked`, `alternative_selected`.

### 3D. Decomposed trust + split reviews

- DB/API: verification evidence model (contact/identity/business/brand-auth/
  fulfillment-proven with machine ID, source, issue/expiry, revocation) —
  feeds Phase 7 seller work but read path ships here.
- Reviews: present product vs seller/fulfillment dimensions separately
  (`reviews.ts` already stores both IDs); fraud/helpfulness controls;
  verified-purchase weight only; no invented ratings.
- UI: verification meaning lines (what was checked), operational performance
  where statistically meaningful, thresholds that don't punish new sellers.

## Migration / rollback

- Backfill offer terms as unknown/empty (honest gaps, no fabricated warranty);
  rollback = hide comparison module when confidence data absent (Level C).

## Acceptance

 Exact variant with 2+ offers: totals honest, switch atomic, paused seller
 blocked, Level C product shows no comparison claims.

## Unconstructive flags

- Peer offers across different variants/products; "best" label without
  explanation; sponsored silently replacing chosen offer; fees/delivery
  revealed only at checkout; fake ratings on empty products.
