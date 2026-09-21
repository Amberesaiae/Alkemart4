# Alkemart marketplace blueprint

**Status:** Approved strategic direction; implementation blueprint

**Prepared:** 2026-09-21

**Scope:** Buyer marketplace, seller operating system, catalog governance,
product comparison, storefronts, homepage merchandising, growth, SEO, trust,
analytics, and delivery sequencing.

## Governing position

Alkemart is a polished, aspirational, multi-vendor shopping destination for
branded goods. Professional shops, boutiques, distributors, and growing brands
own sophisticated storefronts while Alkemart provides discovery, comparison,
checkout, delivery coordination, trust, and business tools.

The African-market adaptation is operational, not a reduction in quality:

- brand and model matter, while GTIN/MPN are enrichment rather than universal
  onboarding gates;
- merchants can start with accurate retail information and progressively
  improve catalog structure;
- exact-product comparison appears only when identity confidence is high;
- shops retain identity and merchandising control inside a governed,
  high-quality marketplace;
- mobile, MoMo, cash on delivery, pickup, locality, and variable addressing are
  first-class realities;
- the visual standard is a modern digital mall, not a classifieds board.

## Product promise

For buyers:

> Discover branded products from credible shops, compare trustworthy offers,
> and choose with confidence across price, availability, delivery, and seller
> quality.

For sellers:

> Open a sophisticated online shop, manage commerce, reach new buyers, and
> build durable marketplace trust.

## Document map

1. [Market position](./01-market-position-and-principles.md)
2. [Taxonomy and catalog](./02-taxonomy-and-catalog.md)
3. [Discovery, search, and filters](./03-discovery-search-and-filters.md)
4. [Comparison, PDP, and trust](./04-comparison-pdp-and-trust.md)
5. [Storefront and seller operating system](./05-storefront-and-seller-os.md)
6. [Homepage Studio and merchandising](./06-homepage-studio-and-merchandising.md)
7. [Marketing, growth, and content](./07-marketing-growth-and-content.md)
8. [SEO and external discovery](./08-seo-and-external-discovery.md)
9. [Trust, safety, and compliance](./09-trust-safety-and-compliance.md)
10. [Analytics and experimentation](./10-analytics-and-experimentation.md)
11. [Repository gap audit](./11-repository-gap-audit.md)
12. [Implementation roadmap](./12-implementation-roadmap.md)
13. [Research register](./REFERENCES.md)

## Decision hierarchy

When documents or implementation details conflict, use this order:

1. Money, privacy, security, and regulatory invariants.
2. Canonical product/variant/offer data integrity.
3. Honest buyer information and earned trust.
4. Marketplace position defined in this blueprint.
5. Evidence-backed usability and accessibility.
6. Merchandising and visual expression.

## Explicit non-goals for the product-commerce launch

- A Jiji-style universal classifieds system covering jobs, CVs, property, and
  services in the retail catalog.
- External-retailer price scraping.
- Fake product matching to increase comparison coverage.
- Mandatory GS1 identifiers for every seller at onboarding.
- Seller-controlled platform taxonomy or trust badges.
- An unrestricted page builder that allows campaigns to destroy homepage
  hierarchy.
- Programmatic SEO pages for every filter permutation.
- Engagement mechanics unrelated to shopping decisions.

## How to use this blueprint

Each implementation phase must identify which blueprint requirements it
satisfies, what data becomes authoritative, the migration path, analytics
coverage, and the buyer/seller acceptance test. Visual work without the
supporting data and operating rules is incomplete.
