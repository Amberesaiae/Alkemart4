# 03 — Discovery, search, and filters

## Discovery architecture

Buyers should be able to enter through four paths without encountering four
different catalog truths:

1. Department/category browsing.
2. Search and suggestions.
3. Product/campaign merchandising.
4. Store and collection browsing.

All routes resolve to canonical products and eligible offers.

## Global navigation

- Search is the primary utility.
- Delivery area is visible early because it changes eligibility and total cost.
- The category rail exposes a deliberate subset of departments and scrolls
  horizontally when needed.
- “All departments” exposes the complete navigation tree.
- Stores remain a first-class destination without displacing product discovery.
- Account and cart are stable utilities, not competing promotional links.

## Search result types

Autocomplete should distinguish:

- products;
- product types/categories;
- brands and models;
- shops;
- seller collections;
- recent and trending queries.

Search ranking starts deterministic:

```text
exact product/model
→ exact product type + brand
→ approved alias/synonym
→ taxonomy path and typed attributes
→ seller collection/tag
→ description
→ availability and delivery eligibility
→ quality/popularity signals
```

Marketing boosts are explicit, labeled, time-bounded, and unable to make an
irrelevant result outrank a strong exact match.

## Search vocabulary

Maintain aliases separately from canonical labels. Examples include fridge ↔
refrigerator, phone ↔ mobile phone, locally used ↔ used, and seller-specific
spellings. Seller words can be indexed with provenance but become global
synonyms only after review.

## Query recovery

Zero-result experiences should:

- show spelling or alias suggestions;
- relax one constraint at a time and explain it;
- offer relevant categories and shops;
- preserve the query for the taxonomy/search-quality queue;
- avoid filling the page with unrelated trending products.

## Category-aware facets

Global facets:

- Price.
- Availability.
- Delivery or pickup eligibility.
- Condition.
- Seller trust tier, when meaningful.
- Rating only when reviewed products exist.

Examples by department:

| Department | High-value facets |
|---|---|
| Phones | Brand, model family, storage, RAM, network, condition |
| Computing | Brand, processor family, RAM, storage, screen size, condition |
| Fashion | Audience, size, colour, material, fit, style |
| Beauty | Brand, product type, skin/hair need, size, formulation |
| Groceries | Brand, pack size, dietary need, availability, delivery speed |
| Appliances | Brand, capacity, energy type, installation, warranty |
| Industrial | Product type, use, material, certification, condition |

Every facet must have normalized data, understandable labels, result counts,
and sufficient coverage. Do not derive filters from arbitrary JSON labels in
the browser.

## Filter interaction

- The URL owns facet state.
- Applied filters appear together above results and are individually removable.
- Result counts update after every committed change.
- Multi-select is used for additive dimensions such as brand or seller.
- Single-select is used for mutually exclusive category refinement when
  appropriate.
- Price entry supports realistic market ranges and validates min/max.
- Mobile uses a sheet with an explicit result count and apply action.
- Back/forward navigation restores the state.
- A filter producing zero results should be disabled or clearly explain the
  consequence before commitment.

## Product-list cards

Cards should answer only the first decision:

- What is it?
- What is the best available price or price range?
- Is it available?
- Is there meaningful earned trust?
- Can I act now?

Seller counts and comparison prompts appear only when they aid the decision,
not as repeated metadata on every editorial rail. Product variations should be
grouped rather than flooding a list with near-identical cards.

## Search projection

Postgres remains authoritative. Search is rebuilt through an outbox/projection
worker from products, variants, offers, taxonomy, collections, sellers, and
reviews. It includes only published, eligible, in-policy records.

Index fields must support identity, category, attributes, offer range,
availability, location/delivery, seller identity, and ranking signals. Index
freshness and failures require operational monitoring.

## Discovery quality metrics

- Search usage and result click-through.
- Zero-result and low-result rate.
- Search refinement rate.
- Category-to-PDP rate.
- Filter adoption and filter removal.
- Time to first relevant product click.
- Duplicate-card rate.
- Products repeatedly reached only through search.
- Query-to-purchase and query-to-no-action.
- Search abandonment after delivery/stock discovery.
