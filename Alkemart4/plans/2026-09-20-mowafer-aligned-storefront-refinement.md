# MOWAFER-aligned Alkemart storefront refinement

**Status:** proposed execution plan — analysis complete, implementation not started  
**Scope:** buyer-facing storefront foundations, global header, homepage, PLP consistency, and PDP hierarchy  
**Protected surface:** the seller store page remains unchanged unless a shared primitive regression requires a compatibility fix  
**Working principle:** preserve Alkemart's commerce logic and marketplace data; replace the mixed MOWAFER/Hubtel presentation with one MOWAFER-shaped, modern Alkemart system

---

## 1. Outcome

The storefront should feel like one product:

- MOWAFER supplies the discovery and comparison hierarchy.
- Alkemart supplies the brand, Ghana context, seller model, delivery language, MoMo and catalogue truth.
- Modern restraint supplies larger touch targets, fewer simultaneous choices, more whitespace and responsive behaviour.

The implementation will use a repeated loop for every section:

```
baseline capture -> isolated implementation -> desktop/mobile preview
-> visual and interaction correction -> acceptance -> next section
```

No section advances merely because it compiles. It advances only after its preview gate is accepted.

---

## 2. Current foundation audit

### 2.1 What is already strong and should be retained

| Foundation | Current evidence | Decision |
|---|---|---|
| Semantic colour and tone tokens | `apps/storefront/src/styles/index.css` | Retain the semantic structure; replace conflicting source values and documentation. |
| Contrast enforcement | tone-ramp and no-cream tests | Retain. Add MOWAFER foundation assertions rather than weakening accessibility. |
| Focus, touch and reduced-motion rules | global stylesheet | Retain unchanged unless preview exposes a defect. |
| Shared merchandising primitives | `packages/ui/src/merchandising.tsx` | Retain as rendering machinery, but constrain which primitives can occupy the public homepage course. |
| Honest content states | `MerchEmpty`, data-backed deals, no invented discounts | Retain as a non-negotiable marketplace trust rule. |
| Product and shop atoms | `ProductCard`, shared store-card primitives | Retain component ownership. Refine anatomy instead of creating parallel cards. |
| Responsive shell and route infrastructure | storefront root route and TanStack/Query setup | Retain. This is a visual-composition change, not a platform rebuild. |
| Existing seller store page | current store route | Freeze. The user has accepted this surface. |

### 2.2 Foundation conflicts that must be resolved first

| Conflict | Current condition | Target decision |
|---|---|---|
| Design identity | Stylesheet is labelled MOWAFER but typography and comments explicitly mirror Hubtel. | MOWAFER hierarchy, Alkemart identity, modern responsive rules. Remove Hubtel as a normative source. |
| Typography | Sora is the active font while the reference pack specifies Montserrat. | Preview Montserrat against the existing wordmark and dense commerce copy; adopt it if metrics remain stable. Do not mix both families. |
| Brand yellow | `#FFC400`, `#FEBF31` and warning gold coexist. | One brand yellow token family derived from `#FEBF31`; warning remains a separate semantic colour. |
| Ink | Current core ink is pure black while MOWAFER uses `#3C3C3B`. | Use `#3C3C3B` for primary ink; reserve black only where contrast testing demonstrates a need. |
| Department hues | Current hues were independently deepened and no longer match the captured board. | Use reference hues as identity accents, then derive accessible soft/ink variants computationally. |
| Radius scale | Many large `20–32px` radii produce a generic soft-card language. | Reduce default commerce radii; keep larger radii only for campaign art and mobile sheets. |
| Header philosophy | Location, search, active navigation and utility actions share one row and multiple yellow pills. | Main row is logo, search, account, cart. Location moves to a quiet context row with category entry. |
| Homepage authority | Studio supports ten section types and can visually overrun the intended course. | Studio controls content within guarded slots. It does not control the primary hierarchy freely. |
| PDP philosophy | Route and buy controls explicitly combine Hubtel and MOWAFER patterns. | Recompose around MOWAFER's decision sequence while keeping existing offer/variant logic. |
| Image system | Mixed crops, aspect ratios and visual sources; some assets repeat across sections. | One Alkemart art-direction system with placement-specific aspect ratios and reuse limits. |

### 2.3 Canonical target tokens

The first implementation preview should use these as source values, with accessible derived tones:

| Role | Source value |
|---|---|
| Brand yellow | `#FEBF31` |
| Primary ink | `#3C3C3B` |
| Paper | `#FFFFFF` |
| Electronics aqua | `#66D1C8` |
| Food yellow | `#FCBF31` |
| Home/pet red | `#F03351` |
| Beverages green | `#AACE3B` |
| Baby neutral | `#E7E4E3` |

These colours are accents and wayfinding. They are not permission to create full-page coloured washes.

---

## 3. Scope and protection rules

1. Do not redesign the seller store page.
2. Do not change API contracts during the foundation and header phases.
3. Do not create a second storefront application; refine the current app in bounded slices.
4. Do not add new homepage section types during this work.
5. Do not generate the complete image library before its placement templates are accepted.
6. Do not remove seller comparison, variants, availability or checkout behaviour from the PDP; only change their presentation and priority.
7. Do not mix foundation, header, homepage and PDP changes in a single review batch.
8. Preserve unrelated working-tree changes and confirm diffs by file before each implementation slice.

---

## 4. Preview matrix

Every visual phase is captured at the same widths:

| Preview | Width | Purpose |
|---|---:|---|
| Mobile compact | 390px | Primary Ghana buyer case; touch, wrapping and sticky controls |
| Tablet | 768px | Header transition, grids and intermediate density |
| Desktop | 1280px | Standard marketplace layout and information hierarchy |
| Wide desktop | 1440px | Max-width, whitespace and image scaling |

For each width capture:

- initial viewport;
- full page where relevant;
- opened location control or menu;
- keyboard focus state for changed controls;
- loading, empty and error states when the component owns them.

Preview filenames follow `phase-surface-width-state.png` so comparisons remain intelligible.

---

## 5. Phased implementation

### Phase 0 — Baseline and guardrails

**Goal:** create a stable before-state and ensure future visual changes can be judged rather than remembered.

**Work**

- Run current typecheck and relevant tests; record pre-existing failures separately.
- Capture home, one PLP and one real PDP at every preview width.
- Capture the accepted seller store page as a regression reference.
- Inventory current homepage section order and identify repeated assets/content.
- Add a short visual acceptance checklist to the design spine.

**Preview gate**

- Baseline images exist for all four surfaces.
- The store-page protection reference exists.
- Known failures are distinguished from changes introduced by this plan.

**Likely files**

- `apps/storefront/src/design/SPINE.md`
- preview artifacts only; no surface implementation

---

### Phase 1 — Design foundation

**Goal:** make colour, typography, spacing, radius and elevation tell one story before changing page composition.

**Work**

- Normalize brand yellow and primary ink.
- Correct reference department colours and derive accessible `soft`, `solid`, `ink` and foreground pairs.
- Decide Montserrat versus Sora through a real header, product card and PDP-title specimen; one family wins.
- Reduce oversized default radii and document the exceptions.
- Define the canonical spacing rhythm:
  - page beat: 48px desktop / 32px mobile;
  - section interior: 24px;
  - component group: 16px;
  - compact control group: 8px;
- Define a restrained elevation scale for dropdown, sticky buy panel and floating controls.
- Replace Hubtel references in the design spine with the accepted Alkemart/MOWAFER rules.
- Add automated token and contrast assertions.

**Preview**

Create a temporary development-only foundation specimen showing:

- wordmark and typography roles;
- buttons and icon controls;
- product-card anatomy;
- department accents;
- neutral cards, dropdown and sticky-panel elevation.

**Correction pass**

- Check headline wrapping with long product and seller names.
- Check yellow/ink contrast and muted-text contrast.
- Check that category hues feel like wayfinding, not a rainbow interface.
- Check that the new radius scale does not alter the accepted seller page; isolate compatibility styles if necessary.

**Acceptance gate**

- One font family, one brand yellow and one primary ink are active.
- No normative Hubtel/Hapto language remains in the storefront design spine.
- Contrast tests and storefront typecheck pass, excluding documented pre-existing failures.
- Store page remains visually equivalent.

**Likely files**

- `apps/storefront/src/styles/index.css`
- `apps/storefront/index.html`
- `apps/storefront/src/design/SPINE.md`
- token/contrast tests under `apps/storefront/src/lib/__tests__/`

---

### Phase 2 — Global header and context navigation

**Goal:** fix the most visible hierarchy problem without disturbing page content.

**Desktop structure**

```
Row 1: [alkemart.] [search................................] [account] [cart]
Row 2: [Deliver to Accra Central] [department links / category entry] [Stores]
```

**Mobile structure**

```
Row 1: [alkemart.]                         [account] [cart]
Row 2: [search...........................................]
Row 3: [Deliver to Accra Central v] [Browse categories]
```

**Work**

- Remove the standalone yellow Search button; use an end icon inside the field.
- Remove yellow active pills from primary navigation.
- Rebuild `DeliverToPicker` as a compact context trigger.
- Preserve location selection behaviour and accessibility.
- Keep account and cart visually quieter than search while maintaining touch targets.
- Cap category chrome at six departments.
- Validate sticky/non-sticky behaviour against long pages.

**Preview**

- Header alone on white and content-backed pages.
- Home, PLP, PDP and store page at all four widths.
- Location menu open, account menu open, cart with 0 and multi-digit counts.

**Correction pass**

- Resolve search compression and location truncation before hiding useful information.
- Verify that the header never wraps into accidental third/fourth lines.
- Test keyboard order: logo -> search -> account -> cart -> location/category context.

**Acceptance gate**

- Search is the dominant header control.
- Location no longer interrupts logo-to-search flow.
- Yellow appears at most once as a primary-action treatment in the header.
- Header passes at 390, 768, 1280 and 1440px.
- Store page content is unchanged beneath the shell.

**Likely files**

- `apps/storefront/src/components/shell/AppHeader.tsx`
- `apps/storefront/src/components/shell/DeliverToPicker.tsx`
- `apps/storefront/src/components/shell/CategoryIconRail.tsx`
- `apps/storefront/src/routes/__root.tsx`
- shell-focused tests

---

### Phase 3 — Homepage course and section constraints

**Goal:** make the homepage read as a deliberate sequence rather than a demonstration of every available primitive.

**Locked public course**

```
1. Category mosaic
2. Deals / featured product decision area
3. One campaign band
4. One proof shelf (top selling or top rated)
5. Store rail / multi-seller proof
6. Delivery and trust band
7. Sell on Alkemart band
8. Footer
```

**Work**

- Preserve the existing mosaic structure, then correct its content and art rules.
- Remove repeated or near-identical promotion sections.
- Enforce one campaign band in the primary course.
- Keep product de-duplication across all shelves.
- Prevent Studio campaigns from appearing before the mosaic or creating adjacent bands of the same job.
- Ensure every section has one heading, one purpose and one destination.
- Eliminate duplicate shell/home component implementations where ownership is ambiguous.
- Keep honest collapse behaviour when the catalogue cannot fill a shelf.

**Preview**

- Wireframe/neutral-art pass first, proving hierarchy without allowing photography to mask layout problems.
- Current-art pass second.
- Full-page captures at all four widths.
- Sparse catalogue and campaign-heavy Studio fixtures.

**Correction pass**

- Remove any section whose buyer question duplicates the section above it.
- Check section cadence and scroll fatigue on 390px first.
- Check that campaign art does not dominate product discovery.
- Verify that product, category and store cards retain a consistent fact order.

**Acceptance gate**

- No adjacent sections perform the same job.
- No repeated image or product appears in consecutive homepage beats.
- Mosaic is always the first merchandising surface.
- At most one campaign band appears in the fixed course.
- Mobile full-page review feels materially shorter and clearer.

**Likely files**

- `packages/shared/src/homepage.ts`
- `apps/storefront/src/components/home/HomepageSections.tsx`
- `apps/storefront/src/components/home/CategoryMosaic.tsx`
- `packages/ui/src/merchandising.tsx`
- Homepage Studio registry/editor constraints where required

---

### Phase 4 — Alkemart image system

**Goal:** produce a coherent image family after the layouts and required crops are known.

**Placement templates**

| Placement | Preferred ratio | Art behaviour |
|---|---:|---|
| Mosaic feature | 16:10 / landscape | Department story, 2–4 products, controlled negative space |
| Mosaic standard | 4:3 | One tight product family, readable at mobile size |
| Campaign band | 5:1 desktop with safe mobile crop | One message, clear copy-safe region |
| Editorial card | 4:3 | Product/lifestyle hybrid, consistent lighting |
| Product card | 1:1 | Clean product truth, neutral or restrained department ground |

**Art direction**

- soft studio lighting;
- deliberate shadows rather than cutout halos;
- one department accent per image;
- no embedded copy, retailer marks or watermarks;
- no mixing photorealism, flat illustration and obvious 3D CGI in one section;
- source image archived beside each processed derivative;
- focal point recorded for every banner placement.

**Workflow**

1. Generate or source one sample family for two departments only.
2. Insert into the accepted homepage layout.
3. Preview all widths and correct crop/contrast.
4. Approve the template.
5. Produce the remaining department family.
6. Run asset provenance, duplication, compression and dimension checks.

**Acceptance gate**

- No watermark or foreign retailer branding.
- Every image survives its mobile crop without hiding the subject.
- No image is reused in adjacent sections.
- All assets have appropriate dimensions, WebP/AVIF derivative where supported and stable focal points.

---

### Phase 5 — PDP decision hierarchy

**Goal:** make the purchase decision understandable before exposing the full product record.

**Desktop sequence**

```
gallery | identity + seller + rating + price + required options | sticky buy panel
        | compact peer-seller comparison                         |
-----------------------------------------------------------------
delivery / returns assurance
description and specifications
reviews
related products
```

**Mobile sequence**

```
gallery -> identity -> seller/rating -> price -> required options
-> compact seller choice -> assurance -> disclosure sections
sticky bottom bar: price + primary Add action
```

**Work**

- Establish one visible price owner per viewport.
- Keep seller identity adjacent to price and purchase action.
- Render only required variants before the CTA.
- Convert peer sellers into a compact comparison list/table.
- Move long attributes and description into calm, labelled disclosure sections below the buying decision.
- Keep reviews below product information; show an earned summary near the title.
- Retain the current offer matrix, seller-pause, availability and cart logic.
- Reduce competition between Add to cart, Buy now, wishlist and share.

**Preview**

- Simple single-offer product.
- Multi-seller product.
- Variant-heavy product.
- Out-of-stock combination.
- Paused seller.
- Product with no reviews/description.
- All cases at 390, 768 and 1280px.

**Correction pass**

- Count simultaneous buttons in the first viewport; only one may read as primary.
- Confirm price is not duplicated between body and sticky purchase surface.
- Confirm seller changes update price/action without layout jump.
- Confirm long option names and seller names do not break the grid.

**Acceptance gate**

- A buyer can identify product, seller, price and primary action without scrolling on standard desktop and common mobile cases.
- Peer-offer comparison is understandable without resembling a second product catalogue.
- Commerce logic tests remain green.
- No invented delivery estimate, discount or scarcity claim appears.

**Likely files**

- `apps/storefront/src/routes/product.$id.tsx`
- `apps/storefront/src/components/product/ProductBuyPanel.tsx`
- `apps/storefront/src/components/product/PeerOffersList.tsx`
- `apps/storefront/src/components/product/ProductImageGallery.tsx`
- `apps/storefront/src/components/product/ProductAttributes.tsx`
- PDP and cart integration tests

---

### Phase 6 — PLP alignment and responsive correction

**Goal:** make discovery pages feel native to the new shell and PDP without expanding their scope.

**Work**

- Reduce oversized PLP hero treatment.
- Compact filter and sort controls.
- Reuse department accent rules from the foundation phase.
- Verify product-card anatomy and grid density against home.
- Perform the final cross-surface responsive, accessibility and performance pass.

**Acceptance gate**

- Header, home, PLP and PDP share one typography, spacing, control and card language.
- No horizontal overflow at the preview widths.
- Keyboard focus order is predictable.
- Changed pages have no material CLS from image loading.
- The accepted seller store page remains intact.

---

## 6. Review protocol

At the end of every phase, provide:

1. before/after screenshots at the preview widths;
2. changed-file list grouped by foundation, component and route;
3. tests/typecheck results;
4. known compromises or data limitations;
5. a short correction recommendation;
6. explicit acceptance before beginning the next visual phase.

Corrections stay inside the active phase. A header correction does not become an excuse to redesign the PDP, and a PDP correction does not reopen approved foundation choices unless it reveals a genuine system failure.

---

## 7. First implementation slice

Begin with **Phase 0 and Phase 1 only**:

- capture the baseline;
- correct and test tokens;
- prepare the typography/radius specimen;
- preview the specimen and the unchanged pages under the proposed foundation;
- correct the foundation;
- seek acceptance.

Do not begin the header until the foundation preview is accepted. This makes every later correction cheaper and prevents another round of local component styling from becoming the system by accident.
