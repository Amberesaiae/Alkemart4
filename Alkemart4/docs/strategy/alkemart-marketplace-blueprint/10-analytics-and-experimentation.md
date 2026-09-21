# 10 — Analytics and experimentation

## Measurement principles

- Analytics never blocks commerce.
- Events use stable machine IDs.
- No unnecessary PII.
- Measure delivered commerce, not only clicks and initiated checkout.
- Marketplace, product, offer, seller, campaign, placement, and category IDs
  remain distinct.
- Every ranking/merchandising feature defines success and guardrails first.

## North-star and health metrics

Primary outcome: **successfully delivered marketplace orders with positive
buyer and seller outcomes**.

Supporting metrics:

- Search/category to qualified PDP rate.
- PDP to offer-selection/add-to-cart rate.
- Cart to checkout and checkout to paid/COD-confirmed rate.
- Order acceptance and delivered-order rate.
- Cancellation, return, refund, dispute, and failed-delivery rate.
- Repeat buyer and retained seller rate.
- Active products with fresh eligible offers.
- Exact-comparison coverage and match accuracy.
- Seller net revenue and payout reliability.

## Event contract

### Discovery

- `view_item_list`
- `select_item`
- `search_submitted`
- `search_zero_results`
- `search_refined`
- `filter_applied` / `filter_removed`
- `category_viewed`
- `collection_viewed`
- `store_viewed`

### Product and comparison

- `view_item`
- `variant_selected`
- `comparison_opened`
- `offer_selected`
- `delivery_checked`
- `alternative_selected`
- `review_read`

### Commerce

- `add_to_cart`
- `remove_from_cart`
- `begin_checkout`
- `payment_initiated`
- `purchase`
- `order_accepted`
- `order_delivered`
- `refund`
- `return_requested`

### Merchandising

- `view_promotion`
- `select_promotion`
- Placement ID, campaign ID, creative ID, product/seller set, position, and
  eligible audience context.

### Seller operations

- Shop setup milestones.
- Product draft/publish/reject/enrich/match.
- Stock/price freshness actions.
- Collection and campaign publication.
- Order SLA and fulfillment transitions.
- Dashboard recommendation acted on.

## Search and taxonomy dashboards

- High-volume zero-result queries.
- Queries with low clicks or conversion.
- Alias/synonym candidates.
- Products repeatedly classified as Other.
- Categories with low supply or overwhelming breadth.
- Most-used facets and facets that cause abandonment.
- Suspected duplicate products and failed identity matches.

## Campaign reporting

Report by placement and campaign:

- Eligible impressions.
- Viewable impressions where measurable.
- Click/PDP rate.
- Add-to-cart and purchase attribution.
- Delivered revenue and seller net impact.
- Cancellation/return guardrails.
- Frequency and fatigue.
- Incrementality when tested.

## Experimentation

Start experiments only after event quality and sample-size expectations are
defined. Randomization unit, exposure event, primary metric, guardrails,
duration, audience, and stopping rule are mandatory.

Do not experiment casually on payment correctness, legal disclosure, trust
meaning, accessibility, or safety. Prefer reversible ranking/layout tests.

## Data quality

- Event schema validation.
- Automated duplicate/missing-ID checks.
- Client/server reconciliation for purchases and refunds.
- Bot/internal-traffic exclusion.
- Tracking health dashboard.
- Documented retention and access controls.
