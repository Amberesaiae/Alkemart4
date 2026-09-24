# Facet scoping contract, and the product-mapping gap

**Status:** proposed · **Date:** 2026-09-24
**Why:** three navigation surfaces disagree about what happens to filters when a
buyer moves, and the match pipeline that powers comparison cannot run at all.

## A. Measured state of the structured catalogue

Production, 2026-09-24:

```
  attribute_definitions        0
  attribute_profiles           0
  product_attribute_values     0
  product_match_candidates     0
  product_images               0
```

Every layer is built and empty. Nothing is broken; nothing has been fed.

## B. Three surfaces, three behaviours

A buyer can change category from three places. Each does something different to
the active filters.

| Surface | Code | Behaviour |
|---|---|---|
| Visual rail (image tiles, above the rail) | `search: { ...search, sub }` | Carries **every** facet, valid or not |
| Sidebar department | `<Link params>` with no `search` | **Drops every** facet |
| Sidebar sub-category | same | Drops every facet |

So clicking "Accessories" in the tile rail while `attrs=ram_gb:8` is active
carries RAM into a category that has no RAM. Clicking the same thing in the
sidebar silently throws away the buyer's price range.

It gets worse at the API. `/store/search` validates filter codes against
**every definition in the system**, not against the destination category:

```ts
const known = new Set((await repo.listAttributeDefinitions()).map(d => d.code))
```

`ram_gb` is globally known, so a stale RAM filter on Accessories passes
validation and returns **0 results with no explanation**. The honest failure
(400 `unknown facet`) never fires, because the code *is* known — just not here.

## C. The scoping contract

Every facet belongs to exactly one class, and the class decides what a
navigation change does to it.

```
  ┌─ UNIVERSAL ────────────────────── always carried ─────────────┐
  │  condition · price · location · delivery · seller · in-stock  │
  │  meaningful in every category, so navigation never drops them │
  └───────────────────────────────────────────────────────────────┘
  ┌─ PROFILE-SCOPED ───── carried only if the destination has it ─┐
  │  brand · ram_gb · storage · size · material · screen          │
  │  kept when the destination profile declares the code,         │
  │  dropped otherwise — and the drop is SHOWN, never silent      │
  └───────────────────────────────────────────────────────────────┘
  ┌─ NAVIGATIONAL ──────────────────────── replaced ──────────────┐
  │  sub-category                                                 │
  └───────────────────────────────────────────────────────────────┘
```

Rules:

1. **One transition function.** `retargetFacets(state, fromCategory, toCategory,
   profiles)` returns the next state plus the list of dropped facets. Every
   surface — tile rail, sidebar, mobile sheet, search page — calls it. No
   surface hand-rolls its own `search` spread again.
2. **Dropping is visible.** A dismissed notice: *"RAM: 8 GB doesn't apply in
   Accessories — removed."* Silent removal and silent retention are both
   dishonest; the buyer must be able to explain their own result count.
3. **The API validates against the destination profile**, not the global
   definition list. A code that is valid somewhere but not here is a 400 with
   that reason, never a silent zero.
4. **Universal facets are declared, not inferred.** A `scope: universal |
   profile` flag on the definition, so the classification is data rather than a
   hardcoded list that drifts.

### Worked example

```
  in  Phones & Electronics › Phones
      attrs = brand:Lenovo ; ram_gb:8        price = 500–2000   cond = Foreign Used

  click  Accessories  (tile rail OR sidebar — identical result)

  out Phones & Electronics › Accessories
      attrs = brand:Lenovo                   price = 500–2000   cond = Foreign Used
              └ kept: Accessories profile declares `brand`
      dropped: ram_gb  → "RAM doesn't apply in Accessories — removed"
```

## D. Product mapping: a review queue with no proposer

The match workflow is built to the doctrine — candidates are evidence, review is
human, no auto-merge:

- `product_match_candidates` (product, candidate, source, evidence, status,
  reviewer) ✅
- `proposeMatchCandidate()` / `listMatchCandidates()` / `reviewMatchCandidate()`
  on both repository implementations ✅
- Admin review endpoints `GET /admin/matches` and `POST /:id/review` ✅

**But `proposeMatchCandidate` is not reachable from any route.** Nothing
generates candidates, so the queue is permanently empty and no product ever
reaches `matched`. Without `matched`, there is no canonical product with many
offers, and therefore no price comparison — the headline feature.

### The proposer

```
  seller publishes
        │
        ▼
  fingerprint = productType + brand + model + required attribute values
        │
        ├── exact GTIN match ......................... propose (source: rules)
        ├── same type + brand + model + attrs ........ propose (source: rules)
        ├── same type + high title similarity ........ propose (source: similarity)
        └── nothing ................................. no candidate, stays seller_specific
        │
        ▼
  admin review queue  →  confirmed  →  both sides `matched`  →  offers cluster
```

Runs on publish, not on draft save. Scoped **within product type** — comparing a
laptop to a laptop is meaningful, comparing within "Electronics" is not. That is
the second reason type matters, after attribute profiles.

## E. Order

```
  S1  retargetFacets() + one transition used by all surfaces   fixes the disagreement
  S2  per-category facet validation in /store/search           kills the silent zero
  S3  scope flag on attribute definitions                      universal vs profile, as data
  S4  route the match proposer; run on publish                 unblocks comparison
  T1  admin console to author definitions + profiles           still the unlock
  T3  category form demands attributes at publish              still the unlock
```

S1–S3 are correctness and can land before any data exists — they are what stops
the work being swept when definitions arrive. S4 is inert until T1/T3 produce
attributes to fingerprint on.

## F. Non-goals

- Auto-merging matched products. Candidates are evidence; review is human.
- Carrying profile-scoped facets across categories "to be helpful".
- Dropping facets silently.
- A hardcoded list of universal facet codes.
