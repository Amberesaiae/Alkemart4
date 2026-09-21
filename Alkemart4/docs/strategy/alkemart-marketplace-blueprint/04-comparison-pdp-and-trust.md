# 04 — Comparison, PDP, and trust

## PDP job

The PDP answers four questions in order:

1. Is this the product I intend to buy?
2. Which variant do I need?
3. Which seller offer is best for my circumstances?
4. Can I complete the purchase confidently?

## Page structure

```text
Breadcrumb and product identity
Gallery + product title/brand/model
Variant selection
Selected offer buy panel
Delivery/pickup promise for selected area
Other seller offers for the exact variant
Specifications and buying guidance
Verified product reviews
Seller/store context
Related alternatives
```

There is one active offer and one price owner in the buy panel. Selecting a peer
offer updates price, stock, fulfillment, seller, policies, and cart identity.

## Exact-offer comparison

Peer offers require the same canonical product and variant. The comparison row
should include:

- Seller and verified status explanation.
- Item price.
- Delivery fee or pickup.
- Estimated total.
- Availability/freshness.
- Delivery estimate when supported by data.
- Condition and warranty differences.
- Return policy summary.
- Seller rating and order performance when statistically meaningful.
- Action to select or add that offer.

## Offer ranking

Default ordering can use a weighted best-offer score, but the buyer must be able
to sort by price, delivery, or seller trust.

```text
eligible for buyer area
→ in stock / fulfillable
→ total payable cost
→ delivery promise
→ seller reliability
→ returns/warranty
→ price
```

Never label an offer “best” without a visible explanation. Paid placement may
be shown only as sponsored and must not replace the chosen offer silently.

## Similar alternatives

Alternatives are different products with comparable intent, budget, or
specifications. They belong below the core product decision and never appear in
the peer-seller table.

## Reviews

Maintain two review concepts:

- Product review: quality and performance of the product.
- Seller/fulfillment review: accuracy, packaging, communication, delivery, and
  returns.

Only verified purchases create rating weight. Show counts, recency, verified
status, and moderation/response rules. Do not invent ratings for empty products.

## Trust model

Verification is decomposed:

- Contact verified.
- Identity verified.
- Business verified.
- Authorized/official brand seller, only with evidence.
- Fulfillment proven through completed orders.

Operational trust includes completed orders, cancellation rate, late/failed
fulfillment, response time, return rate, dispute outcomes, listing accuracy,
and account age. Thresholds must avoid punishing new sellers with tiny samples.

## Price integrity

- Compare-at price requires provenance and history.
- Percentage-off labels require a real reference price.
- Price changes are logged.
- Excessive price divergence triggers review rather than automatic accusation.
- Fees and delivery costs are exposed before checkout.
- Stock freshness is visible internally and stale offers are suppressed.

## Failure states

- No active offer: preserve product information and offer restock/shop paths.
- One offer: remove comparison language.
- Peer offers loading: never auto-switch the buyer's selection.
- Variant unavailable: explain and suggest valid variants.
- Delivery unavailable: preserve pickup or other eligible sellers.
- Seller paused: retain lawful product history but block checkout.
