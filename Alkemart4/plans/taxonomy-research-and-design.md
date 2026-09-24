# Taxonomy: research, and a three-axis design

**Status:** proposed · **Date:** 2026-09-24
**Extends** [`docs/architecture/catalog-taxonomy-and-discovery.md`](../docs/architecture/catalog-taxonomy-and-discovery.md)

## 1. What the reference marketplaces actually do

### Google Shopping — depth, identity, one product many sellers

- **21 top-level categories, ~6,000+ nodes, up to 7 levels**, each with a
  numeric ID (`google_product_category`).
- Offers from different merchants are **clustered onto one canonical product**,
  so shoppers compare price, shipping and availability on a single card.
- Clustering runs on an **identity ladder**: GTIN first; without one, Google
  falls back to a *fingerprint* of title similarity + brand + attributes.
- Consequence: the taxonomy is not navigation. Almost nobody browses 7 levels.
  It exists so that machines can classify, match and rank.

### Jumia — enforced depth at posting time

- Sellers must drill to the **product-type leaf**; broad picks are rejected.
  Their own example is five levels: `Home & Office > Home & Kitchen >
  Kitchen & Dining > Kitchen & Cooking Small Appliances > Blenders`.
- Explicit rule: *"choosing the best category ensures that you see the most
  appropriate attribute fields for your product."*

### Jiji Ghana — breadth, and type as a facet

- **17 top-level categories**, reaching where retail taxonomies do not:
  Services, Repair & Construction, Commercial Equipment & Tools, Business &
  Industry, Jobs, Seeking Work – CVs, Property, Food/Agriculture.
- Browse depth stays shallow — `Electronics > Laptops & Computers` is level 3.
- Then **product type is a facet, not a deeper node**: Laptop / Desktop /
  Server sit *inside* the category page.
- That category carries **11 attribute facets** — Brand (40+), RAM, Processor,
  Storage Capacity, Storage Type, Display Size, OS, Graphics Card, Condition,
  Price (bucketed **with counts**), Location.
- Two axes that only make sense here:
  - **Condition is four-valued: Brand New / Refurbished / Local Used /
    Foreign Used.** "Foreign used" is a quality signal in Ghana, not a synonym
    for "used".
  - **Exchange Possible (barter)** as a first-class filter.
- Location sits beside category as a peer, never beneath it.

### The theory

Ecommerce taxonomies are hierarchical for browsing, with facets for narrowing
at the leaf; the recommended structure is a **hybrid**, and **polyhierarchy**
(one product reachable from several paths) is normal rather than a smell.

## 2. What this means for Alkemart

Three things the references agree on, that we do not do:

1. **Depth belongs to data, not to menus.** Google has 7 levels and a flat UI.
   Jiji has 3 browse levels and 11 facets. Nobody navigates deep trees.
2. **The category determines the form.** On both Jumia and Jiji you cannot post
   without completing the fields that category demands. Optional structured
   data is never filled in — which is exactly why our facets are empty.
3. **Identity is what turns many listings into one comparable product.** This
   is the whole basis of Google Shopping's card, and it is our `Product ≠
   Offer` doctrine. It cannot work without attributes.

## 3. The design: three orthogonal axes

The instinct is to deepen the category tree to five or seven levels. That is
the wrong move: it makes the menu unusable on a phone, forces sellers to guess,
and creates thousands of nodes to govern.

Instead, split what a single tree is currently overloaded with:

```
  AXIS 1  CATEGORY      where it lives     shallow, 3 levels, browsable
  AXIS 2  PRODUCT TYPE  what it is         flat vocabulary, owns attributes
  AXIS 3  FACETS        what it is like    attributes · condition · location · price
```

### Axis 1 — Category (browse)

Max three levels, `Department > Family > Category`, tuned for a thumb. Grows to
Jiji's 17 departments so the informal economy — services, repair, commercial
equipment, agriculture, jobs — is representable.

### Axis 2 — Product type (classify) — *the load-bearing idea*

A **flat, governed vocabulary** (`laptop`, `blender`, `safety-helmet`,
`plumbing-service`), attached to leaf categories many-to-many. The **type owns
the attribute profile**, not the category.

Why this is better than deepening the tree:

- **The menu stays shallow while the data gets precise.** Google needs 7 levels
  because its category *is* the type. Separating them gets Jumia's precision at
  Jiji's browse depth.
- **Polyhierarchy for free.** `blender` belongs under Home & Kitchen *and*
  Commercial Equipment. One type, one profile, two paths — no duplicated nodes
  drifting apart.
- **One profile per type, reused everywhere.** Today a profile hangs off a
  category, so the same attributes get re-authored per branch.
- **Type is the matching key.** Identity fingerprints are computed within a
  type; comparing a laptop to a laptop is meaningful, comparing within
  "Electronics" is not.
- **It is a small change.** `products.productType` already exists, and
  `categories.attributeProfileId` already exists. This adds a `product_types`
  table and moves profile ownership onto it.

### Axis 3 — Facets, with Ghana in them

Universal facets alongside the per-type ones:

| Facet | Values | Note |
|---|---|---|
| Condition | Brand New · Refurbished · Local Used · Foreign Used | Not a generic used/new split |
| Location | Region → District | Peer of category, never under it |
| Price | Bucketed, **with counts** | Jiji shows counts; counts are what make a facet trustworthy |
| Exchange | Barter accepted | Real in this market |
| Seller trust | Verified / band | We already have verifications |

## 4. Why this unlocks price comparison

Our headline feature needs many sellers on **one** product. That needs identity.
Ghana is a GTIN-poor market — most goods are unbarcoded or second-hand — so
Google's GTIN-first path mostly will not fire, and its fallback becomes our
primary: **brand + model + type + required attributes as a fingerprint**.

`identityConfidence` (`identified` / `matched` / `seller_specific`) already
exists. The ladder becomes:

```
GTIN present                          → identified
type + required attributes + brand    → matched   (fingerprint clustering)
neither                               → seller_specific (no comparison claims)
```

So the attribute work is not filter plumbing. It is the precondition for the
comparison feature, and the reason to do it before the comparison tray.

## 4b. Keeping it light for common goods

The failure mode of any attribute system is demanding structure from sellers who
have none to give. Two safeguards are already in the schema —
`attribute_definitions.required` and `profile_attributes.required` both default
to **false**, and `quick-sell` already exists as a low-friction path. What is
missing is the rule that stops someone marking everything required later.

**A field is required only when it is (a) something buyers actually filter on
and (b) answerable by looking at the item.** If a seller has to go and research
the answer, it must not be required.

| Tier | Examples | Required | Matching |
|---|---|---|---|
| A · Identified | phones, laptops, branded electronics | 3–5 | fingerprint ✓ comparison ✓ |
| B · Commodity | rice, cooking oil, cement, sugar | 2–3 (brand, size, unit) | fingerprint ✓ comparison ✓ |
| C · Variable | second-hand clothes, crafts, produce, used furniture | 0–1 | none — stays `seller_specific` |
| D · Services | plumbing, tailoring, cleaning | 0 | not a product |

Tier B is where comparison pays off most for everyday shopping: "5kg Royal Aroma
rice" from three sellers genuinely is one product, and it needs two fields, not
fifteen. Tier C is already handled honestly — `identityConfidence:
seller_specific` is the floor, and Phase 3 already says a Level C product shows
no comparison claims.

**Tier D is a genuine misfit.** `Services` is a department, so a plumber's
listing runs through the product pipeline with `pricePesewas` and `onHand`;
"4 in stock" for pipe repair is nonsense. Jiji treats Services, Jobs and CVs as
different posting *kinds*, not product categories. That is a larger decision
than this plan and is called out rather than solved here.

T1 carries the guardrail: the profile editor shows a required-count per type,
warns above ~5, and defaults new types to zero required — so the cheap path is
the default one.

## 5. Sequence

| | Slice | Why here |
|---|---|---|
| **T1** | Admin attributes + types console | Nothing can be authored today; there is no attributes UI at all |
| **T2** | `product_types` table; move profile ownership onto type | The structural change everything else needs |
| **T3** | Category-specific listing form; required **at publish**, not at draft | The Jumia/Jiji mechanic — the thing that actually fills the data |
| **T4** | Grow to 17 departments, 3 levels; retire `mega-taxonomy.ts` | Removes the second hardcoded tree and its 84 fake categories |
| **T5** | Ghana facet axes: 4-valued condition, location, barter | Cheap, and differentiates immediately |
| **T6** | Fingerprint matching within type → `matched` confidence | Turns the data into the comparison feature |

Rationale for the order: T3 before T4. Deepening the tree first only produces
more empty nodes; making the form demand attributes produces data, and the data
is what makes any of it visible.

## 6. Explicit non-goals

- **Not** a 7-level browse tree. Depth goes into types and facets.
- **Not** required attributes at draft. A seller on bad mobile data must be
  able to save half a listing.
- **Not** seeded attribute values on existing products to make facets look
  populated. That is fabricated catalogue data.
- **Not** vendor tags auto-promoted to global synonyms — already an
  unconstructive flag in the architecture doc.

## Sources

- [Google product category — Merchant Center Help](https://support.google.com/merchants/answer/6324436?hl=en)
- [Google Product Category taxonomy guide](https://www.webtoffee.com/blog/google-product-taxonomy/)
- [About unique product identifiers — Merchant Center Help](https://support.google.com/merchants/answer/160161?hl=en-GB)
- [Google Shopping product ID matching process](https://readme.priceapi.com/docs/google-shopping-product-id-matching-process)
- [Jumia VendorHub Ghana — Categorization](https://vendorhub.jumia.com.gh/categorization/)
- [Jiji Ghana](https://jiji.com.gh/) · [Jiji Laptops & Computers facets](https://jiji.com.gh/computers-and-laptops) · [Jiji posting rules](https://jiji.com.gh/faq/10)
- [Faceted classification and faceted taxonomies — Hedden](https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/)
- [Ecommerce category structure: taxonomy, facets & navigation](https://www.quape.com/ecommerce-category-structure/)
