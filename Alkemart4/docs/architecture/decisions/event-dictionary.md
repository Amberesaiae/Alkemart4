# Event dictionary (Phase 0B)

**Status:** living document · **Rule:** analytics never blocks commerce; no
unnecessary PII; product / offer / seller / campaign / placement / category IDs
stay distinct (blueprint Doc 10).

Conventions: `snake_case` machine IDs; money in pesewas integers where sent;
`surface` prop names the UI surface. `safeProps` in
`apps/storefront/src/lib/analytics.ts` strips PII. Contact, address, payment,
and order-reference identifiers are forbidden in props unless a row below
explicitly allows them with a lawful need.

## Implemented (storefront, PostHog, env-gated)

| Event | Trigger | Required props |
|---|---|---|
| `$pageview` | `trackPageview` — route change | `path` |
| `homepage_viewed` | home route | `product_count, category_count, seller_count, has_featured, surface=storefront_home` |
| `product_viewed` | PDP load (`view_item` alias pending) | `product_id, product_name?, price?, currency?, seller_id?` |
| `product_added` | add-to-cart (must carry `offer_id`) | `product_id?, offer_id, quantity, price?, currency?` |
| `checkout_started` | checkout entry (`begin_checkout` alias pending) | `item_count, cart_total?, currency?` |
| `order_completed` | purchase confirm (`purchase` alias pending) | `payment_method, item_count?, has_total, currency?` |
| `search_performed` | search submit (`search_submitted` alias pending) | `query, result_count?` |
| `seller_store_viewed` | shop route (`store_viewed` alias pending) | `seller_handle, seller_id?` |
| `homepage_search_chip` | home search chip tap | chip id |
| `homepage_department_chip` | home department chip tap | department id |
| `search_landing_viewed` | empty search landing | `surface=search_empty` |
| `search_suggestion_clicked` | suggestion tap | suggestion value |

## Planned (phase-gated; canonical names from blueprint Doc 10)

Discovery (Phase 2): `view_item_list, select_item, search_zero_results,
search_refined, filter_applied, filter_removed, category_viewed,
collection_viewed`. Product/comparison (Phase 3): `view_item,
variant_selected, comparison_opened, offer_selected, delivery_checked,
alternative_selected, review_read`. Commerce (Phase 7 reconciliation):
`remove_from_cart, payment_initiated, order_accepted, order_delivered, refund,
return_requested`. Merchandising (Phase 5): `view_promotion,
select_promotion` (+ placement/campaign/creative/set/position/audience).
Seller ops (Phase 4/7): setup milestones, draft/publish/reject/enrich/match,
stock-price freshness, collection/campaign publication, SLA transitions,
recommendation-acted-on.

## PII classification

- Allowed without review: IDs, counts, prices, currency, category/surface labels.
- Needs documented lawful need + review: buyer contact, address/landmark,
  payment identifiers, order references, seller payout identifiers.
- Never: PINs, passwords, full message bodies, precise geolocation.
