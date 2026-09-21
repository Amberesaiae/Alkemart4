# 05 — Storefront and seller operating system

## Storefront role

The store is a merchant-owned destination inside Alkemart's governed commerce
system. It should feel like a polished branded shop, not a profile attached to
classified listings.

## Public store anatomy

```text
Identity: logo, banner, name, short proposition
Trust: verification meaning, rating, completed-order evidence
Fulfillment: location, delivery areas, pickup, operating status
Navigation: collections and store search
Merchandising: featured/popular/new products
Catalog: all eligible products
Proof: verified buyer reviews
Policies: returns, warranty, delivery, support
Story: about the business and authorized-brand relationships
```

The existing store-page visual skeleton remains the base. Work should complete
its data and operating behavior rather than replace it with a generic PLP.

## Collections

Sellers create named, ordered collections with images, descriptions,
visibility, and optional schedules. Collections can include products from
multiple marketplace categories but cannot change product classification.

## Seller dashboard domains

### Setup and identity

- Onboarding progress and readiness.
- Shop profile, media, policies, hours, delivery, pickup, and contacts.
- Verification status and required actions.

### Catalog and inventory

- Products, variants, offers, stock, pricing, and bulk editing.
- Catalog-match suggestions and merge review.
- Product-quality score with actionable missing fields.
- Media quality and policy feedback.
- Collections and featured products.

### Orders and fulfillment

- New-order queue and service-level timers.
- Pick/pack/ready/handover/delivered lifecycle.
- Delivery and pickup coordination.
- Cancellations, returns, disputes, and evidence.

### Money

- Gross sales, commission, fees, refunds, and net payout.
- Payout schedule/status and reconciliation.
- Downloadable statements.
- Payment-account readiness without exposing sensitive credentials.

### Customers and reputation

- Buyer enquiries using structured, moderated channels.
- Reviews and one seller response.
- Repeat-customer and collection insights without exposing unnecessary PII.

### Growth

- Shop visits, product impressions, conversion, and top search terms.
- Campaign performance.
- Low-stock, stale-product, and content-quality recommendations.
- Shareable store/collection links and approved promotional assets.

## Progressive seller activation

```text
1. Create account and shop identity
2. Complete contact/location/payment readiness
3. Add an accurate first product and offer
4. Pass marketplace review
5. Configure fulfillment and policies
6. Receive orders and build operational trust
7. Enrich catalog, collections, and campaigns
```

Do not front-load advanced catalog requirements before the seller understands
their value. Regulated product types still require mandatory evidence before
publication.

## Shop ownership boundaries

Sellers control shop identity, descriptions, collections, product content
within schemas, prices, stock, supported fulfillment, policies within platform
minimums, featured products, and approved promotions.

The platform controls canonical taxonomy, identity matches, trust labels,
review integrity, prohibited goods, marketplace ranking, sponsored labels,
payment state, disputes, and platform-wide campaigns.

## Mobile and low-friction operations

- Dashboard workflows must work on a phone.
- Drafts survive interrupted connectivity.
- Images are compressed and resumable.
- Bulk operations have clear undo/review boundaries.
- Status changes use short, unambiguous actions.
- Notifications lead directly to the relevant order/product task.

## Seller success metrics

- Time to first published offer.
- Time to first order.
- Listing completion and catalog-match rate.
- Stock and price freshness.
- Order acceptance and fulfillment success.
- Return/cancellation/dispute rate.
- Storefront conversion and repeat buyers.
- Seller retention and payout reliability.
