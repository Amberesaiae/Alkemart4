# 09 — Trust, safety, and compliance

## Trust architecture

Trust must be decomposed into claims the platform can prove.

```text
contact verified
identity verified
business verified
brand authorization verified (separate evidence)
fulfillment proven (operational evidence)
```

Every badge has a machine ID, definition, evidence source, issue/expiry dates,
and revocation workflow. “Verified” must not imply product authenticity,
delivery performance, or brand authorization unless those were verified.

## Seller risk controls

- Identity and beneficiary/payment-name review.
- Device/account velocity and duplicate-account signals.
- Admin two-person controls for sensitive payout/trust changes.
- Price, stock, bank/MoMo, policy, and ownership audit trails.
- Payout holds for unresolved fraud/refund exposure where contractually lawful.
- Graduated limits for new sellers.
- Seller appeals and documented enforcement reasons.

## Catalog and product safety

- Prohibited and restricted product policy.
- Category-specific moderation rules.
- Counterfeit and intellectual-property reporting.
- Product authenticity/authorization evidence where claimed.
- Regulatory evidence for food, cosmetics, medicines, agrochemicals, electrical
  goods, safety equipment, and other controlled categories.
- Recall/takedown workflow that reaches affected orders.
- Media and description moderation.

## Review integrity

- Verified purchases only for weighted ratings.
- One review entitlement per fulfilled line/order policy.
- Conflict-of-interest and coordinated-review detection.
- No seller deletion of critical reviews.
- One accountable seller response.
- Moderation states, appeals, and immutable provenance.
- Separate product and fulfillment dimensions.

## Promotion integrity

- Real promotion ID, dates, eligible products, and terms.
- Reference-price provenance before showing discount percentage.
- No fake countdowns or stock scarcity.
- Shipping promotions explain area and threshold restrictions.
- Sponsored placement is labeled.
- Expired creatives and claims are automatically removed.

## Buyer protection

- Supplier/shop identity and support details.
- Total price and material terms before order confirmation.
- Order record and receipt.
- Delivery/pickup status.
- Cancellation, return, refund, and dispute paths.
- Accessible complaint handling and response expectations.
- Clear allocation of marketplace versus seller responsibilities.

## Payment boundaries

Use licensed payment providers for regulated processing. Alkemart stores payment
references and commerce state, never buyer PINs. Webhooks are verified and
idempotent. Money uses integer pesewas. Payment success is not inferred from
browser redirects alone.

## Privacy and data protection

- Document controller/processor roles.
- Collect only operationally necessary buyer/seller data.
- Purpose, retention, access, correction, deletion, and incident workflows.
- Restrict sellers to fulfillment data for their own orders.
- Keep analytics free of direct contact, address, payment, and order-reference
  identifiers unless a lawful, documented need exists.
- Consent/preferences for promotional messaging.
- Security and breach response aligned with Ghanaian obligations.

## Security baseline

- MFA for admin and seller high-risk actions.
- Strong session rotation and revocation.
- Rate limits and abuse controls.
- Signed uploads and media validation.
- Dependency and secret scanning.
- Least-privilege service/database access.
- Backup/restore and incident exercises.
- Fraud and security reporting channel.

## Accessibility and fairness

- WCAG-aligned keyboard, screen-reader, contrast, error, and checkout behavior.
- Colour never carries the only meaning.
- Simple language for critical commerce terms.
- Trust/ranking systems monitored for unfair new-seller or regional exclusion.
- No dark patterns in cancellation, consent, checkout, or promotions.

## Ghana-specific caution register

- Seller/business impersonation.
- Payments requested to unrelated personal wallet names.
- Fake parcel/delivery messages.
- Unrealistic social-media promotions.
- Address and last-mile variability.
- High COD cancellation/failed-delivery risk.
- Limited seller awareness of ecommerce regulation.
- Counterfeit and substandard goods.
- Regional delivery and connectivity limitations.

Legal and regulated-category requirements need qualified Ghanaian legal and
compliance review before production policy is finalized.
