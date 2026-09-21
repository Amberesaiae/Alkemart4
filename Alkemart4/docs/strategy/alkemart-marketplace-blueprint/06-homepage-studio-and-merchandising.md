# 06 — Homepage Studio and merchandising

## Homepage course

The homepage is a governed buying journey, not a dump of CMS sections.

```text
1. Department discovery
2. Primary commercial story
3. Product/deal decision area
4. Behavioral product proof
5. Seller/store proof
6. Delivery and payment trust
7. Seller acquisition
```

Desktop and mobile can express these beats differently while preserving their
jobs and hierarchy.

## Placement model

Studio should manage named placements with constraints rather than arbitrary
blocks:

| Placement | Job | Allowed content |
|---|---|---|
| Department theatre | Enter catalog | Governed category mosaic |
| Lead campaign | One current commercial message | Campaign creative |
| Decision area | Move to product selection | Deal hub or curated shelf |
| Product proof | Earned market signal | Trending, ordered, rated |
| Shop proof | Establish marketplace ownership | Eligible store rail |
| Trust story | Reduce purchase anxiety | Delivery/payment/returns message |
| Seller acquisition | Grow supply | Sell-on-Alkemart message |

The system enforces maximum live instances per placement and resolves priority
conflicts deterministically.

## Campaign entity

```ts
type Campaign = {
  id: string
  name: string
  objective: "discovery" | "conversion" | "trust" | "seller_growth"
  placementId: string
  audienceRuleId?: string
  productSetId?: string
  sellerSetId?: string
  eligibilityRuleId?: string
  desktopCreativeId: string
  mobileCreativeId: string
  promotionTermsId?: string
  startsAt: string
  endsAt: string
  priority: number
  frequencyCap?: number
  trackingId: string
  status: "draft" | "review" | "scheduled" | "live" | "ended"
}
```

Creative, offer eligibility, schedule, destination, and measurement are
separate concerns. A campaign must not remain live when products are
unavailable or terms have expired.

## Creative rules

- Campaign images may contain carefully composed headline text when treated as
  complete ad creative.
- The site must not duplicate that headline as a second overlay.
- Creatives need desktop/mobile versions, focal points, alt text, and safe text
  zones.
- Images cannot promise unsupported discounts, delivery times, authenticity,
  or stock.
- The destination must match the advertised products or collection.
- Campaign art can be expressive; catalog cards remain consistent.

## Studio workflow

```text
Brief
→ choose objective and placement
→ choose product/seller set
→ set eligibility and terms
→ attach responsive creative
→ preview buyer view
→ validate
→ review/approve
→ schedule/publish
→ monitor
→ expire/archive
```

## Validation

Studio blocks publication or raises explicit warnings for:

- Missing destination.
- Missing mobile/desktop creative.
- Invalid schedule.
- Promotion without terms or eligible products.
- Products with missing price, image, stock, or publication state.
- Seller not eligible or suspended.
- Conflicting campaign priority.
- Unsupported claims.
- Duplicate campaign creative in adjacent placements.
- Missing tracking ID.

## Preview and operations

- Real storefront preview at common phone/tablet/desktop widths.
- Delivery-area and signed-in/signed-out preview contexts.
- Draft versus live comparison.
- Revision history and rollback.
- Upcoming/ending calendar.
- Asset usage and expiry inventory.
- Performance by placement, creative, product set, and audience.

## Merchandising sources

Rule-backed shelves must define eligibility before ranking. Examples:

- Trending: qualified views/adds/orders over a recent window.
- Most ordered: delivered units, not initiated orders.
- Top rated: sufficient verified review count and confidence.
- Near me: eligible fulfillment to selected area.
- New: recently published and in stock.
- Price drop: real price history.

Manual curation remains available but records editor, reason, schedule, and
sponsorship status.

## Guardrails

- Sponsored inventory is labeled.
- One campaign cannot dominate several adjacent placements.
- Personalization cannot hide essential navigation.
- Empty rule-backed sections collapse honestly.
- Campaign performance never overrides relevance or policy eligibility.
- Studio publication creates an audit event.
