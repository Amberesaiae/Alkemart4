# Product variants — recommended approach

## Current state (verified in-repo)

- **Server is single-variant.** `POST /vendor/products` accepts one
  `variantTitle` + one price + one stock figure; every product gets exactly
  one variant and one offer (`createVendorProduct`).
- **The client already pretends otherwise — and the server silently drops
  it.** `quickList()` types `variant_options` / `variant_entries`, quick-sell
  step 2 collects them, but the POST body never includes them. Zod strips
  unknown keys, so vendors do the work and lose it. This is the first bug
  to fix regardless of direction.
- **Buyer side has no variant selector.** PDP handles cross-*seller* peer
  offers, not variants of one product. ATC binds `offerId`, which is the
  right seam to keep.

## What the research says (2025–2026, Baymard/Shopify ecosystem)

**Buyer side (converged wisdom):**
- One picker per attribute, stacked with labels — never combine attributes
  into one dropdown. Pills for size/short labels, swatches for colour,
  image swatches for pattern/texture, dropdown only for 50+ values.
- Show all options at a glance (one tap to choose); strikethrough OOS
  instead of hiding; live price/stock update on selection; ≥44px touch
  targets; selected state never colour-alone (ring/check).
- Expected lift: +10–20% ATC vs dropdowns; keep combos ≤ ~30 or decision
  paralysis eats the gains.

**Vendor side (Shopify/Jumia-pattern):**
- Cap at **2 option types** for small sellers (Size + Colour covers ~95%
  of Ghana-market cases: apparel, shoes, hair, provisions packs).
- Matrix grid with per-combo price/stock + "apply to all" is the proven
  creation pattern; post-publish, vendors need to **add values, archive
  combos (never delete history), and edit price/stock per combo**.

## Recommendation for Alkemart

**"Simple matrix, offer-per-variant, archive-don't-delete."**

1. **Data:** `product_options (product_id, name, position)`,
   `product_option_values (option_id, value, position)`,
   `variants (product_id, sku, price_override_pesewas, active)` +
   `variant_option_values (variant_id, value_id)`; **one offer per
   variant** so checkout/ATC (`offerId` binding), payouts, and reviews
   keep working untouched. Cap: 2 option types, ≤30 combos.
2. **Creation (vendor):** keep quick-sell's 2-step wizard. Step 2 becomes:
   option names as free text with suggestions (Size, Colour, Flavour,
   Pack), values as comma input → live combo grid with per-row price/stock
   + "same for all" fill. Creating with zero options keeps today's
   single-variant path byte-identical.
3. **Post-publish editing:** dedicated Variants section on
   `products/$id`: add/remove values (adding generates new combos as
   drafts), per-combo price/stock inline, toggle active (archived combos
   stay readable for order history but leave the catalog), rename values
   in place. Never hard-delete a variant that has orders.
4. **Buyer PDP:** pill row per attribute; selecting a full combo resolves
   to its offer (price/stock swap live, ATC binds that offerId);
   partial selection disables ATC with "Select Size" hint; OOS combos
   struck through, still visible.
5. **Explicit non-goals:** 3+ option types, per-variant images v1 (reuse
   product images; variant→image mapping is the known follow-up),
   variant-level SEO URLs (single canonical product URL).

## Phases

- **V1 (API) — SHIPPED + proven live.** Tables (`product_options`,
  `product_option_values`, `variant_option_values`, migration 0016),
  `variant_options`/`variant_entries` accepted on `POST
  /vendor/products`, `PATCH .../variants/:variantId`
  (price/stock/active, never re-reviews),
  `POST .../options` (add value / first option type, re-reviews on
  structural change), full `options`+`variants` in product DTOs,
  `quickList` now actually sends the matrix (silent-drop fixed).
  Verified: 9 API tests + live create→patch→add-value cycle.
- **V2 (vendor UI) — mostly shipped.** Edit-product page has the
  Combinations section (per-combo edit/archive/add); quick-sell
  already collects and now sends entries. Remaining polish: combo
  grid preview inside quick-sell step 2.
- **V3 (storefront) — SHIPPED + proven live.** `ProductDetailDto`
  carries `optionTypes` + every combo (incl. unstocked/archived) +
  per-offer option maps; PDP renders one radiogroup per attribute
  (pills, 44px targets, live labels, focus rings, colour-independent
  selection), preselects the cheapest buyable combo, strike-throughs
  unbuyable values without hiding them, narrows the seller picker to
  the chosen combo, and disables ATC with named reasons
  (Select X / out of stock / no longer available / paused shop).
  Verified live with a throwaway vendor (created → approved →
  screenshot → full SQL cleanup).

## Addendum — gaps closed on second pass

1. **Re-moderation semantics (repo-consistent).** `updateVendorProduct`
   already flips published→proposed on *content* edits but not on
   price/stock/active. Variant rules follow the same line: new
   values/combos, renames, and option changes → back to `proposed`;
   per-combo price/stock/active toggles → stay published. No new
   policy to invent.
2. **`stockMode` is currently dead — variants give it meaning.**
   Stored (`exact`|`bands`) but never read. Define: in `bands` mode
   every combo renders "In stock / Low stock / Out of stock" instead
   of counts (threshold: low when sellable qty ≤ 3). Per-combo
   sellable qty still comes from the same offer stock.
3. **SKUs must be auto-generated, never required.** Informal sellers
   don't do SKUs. Default `{handle}-{initials}-{n}`, editable, unique
   per seller. `variantTitle` becomes a legacy alias for the single
   combo's display name.
4. **Ghana-flavoured suggestions, not generic placeholders.** Option
   names: Size, Colour, Flavour, Pack, Length. Value hints: apparel
   (S–XXL), shoes (EU 38–45), fabric (6 yards, Half-piece),
   provisions (Sachet, Bottle, Pack of 3), hair (8", 12", 18").
   Colour names in plain words (Navy, Wine, Ankara Mix) per the
   research warning against creative names.
5. **Variant images graduate to V1.5, not V3.** Fashion/hair/Ankara
   (core Ghana categories) convert on shade accuracy; a colour pill
   lying about "Red Tartan" destroys trust. Mapping: one image per
   *value* of the designated visual option (not per combo —
   combinatorial explosion otherwise).
6. **Zero-migration story.** Every existing product is already a
   1-combo product; V1 backfills one option-less variant per product
   implicitly (no data migration — represent as a combo with zero
   options at read time).
7. **Search/facets follow-up (V4).** Size/colour facet filters on
   listing pages need the value vocabulary normalized first
   (collect raw values in V1, normalize in V4 — don't block V1 on
   taxonomy).
8. **Analytics follow-up.** Vendor stats break down units/GMV per
   combo (which size actually sells) — reads off order items via
   offer→variant, no new tables.
9. **Cart edge already guarded.** A combo archived with live carts
   fails at ATC/quote time through existing `isSellable` ("offer not
   sellable"); no new code, but the buyer-facing message should name
   the combo ("Size M is no longer available").
10. **V3 accessibility bar (from research).** 44px targets, live
    "Colour: Cognac" label on selection, visible focus rings (never
    `outline: none`), ARIA-labelled options, selected state never
    colour-alone.
11. **Explicitly out:** shared stock pools across combos (e.g. one
    fabric roll, many colours) — per-combo stock + bands mode is the
    honest approximation; true pooled inventory is its own project.
