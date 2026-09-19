# Mowafer Storefront Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/storefront-mowafer` and rebuild the buyer storefront as a faithful Mowafer-shaped, shadcn/Radix UI that talks to the existing Workers API — without patching the live buggy `apps/storefront` until cutover.

**Architecture:** Greenfield Vite + TanStack Router + React Query app that reuses `@workspace/ui`, `@alkemart/shared`, and `@alkemart/api-client`. UI follows the atomic clone pack section-by-section (tokens → chrome → home → PLP → PDP → cart/checkout → mobile). Production `apps/storefront` stays on port `5175`; the clone lab runs on port `5176` until cutover.

**Tech Stack:** Bun workspaces, Vite 7, React 19, TanStack Router, TanStack Query, Tailwind CSS 4, shadcn New York, Radix primitives, Vitest, Workers API (`@alkemart/api-client`).

**Spec:** [docs/research/mowafer-behance-clone/00-MASTER.md](../../research/mowafer-behance-clone/00-MASTER.md) (+ `01`–`10` in the same folder)

## Global Constraints

- Do **not** modify `apps/storefront` production routes for clone work; copy patterns out, do not dual-edit.
- Primary yellow `#FEBF31` / Alkemart spark family as `--primary`; ink `#3C3C3B`; gold is accent/CTA only — no `bg-primary/N` washes.
- Typography: **Montserrat** (Latin). Cairo/AR deferred.
- Honesty gates: no invented `% off`, ratings, stock meters, or fake catalogue fill; peer offers only when `offerCount > 1`.
- Multi-seller peer offers replace Mowafer multi-retailer scrape — never scrape Jumia/Souq/Noon.
- Non-goals v1: loyalty points, wishlist, compare list, articles magazine, bilingual AR.
- Phase gate: do not start phase N+1 until phase N acceptance in the matching spec file is met.
- Icon category rail max **6** departments; mosaic is first home beat; Studio campaigns never lead.
- Shared packages only via workspace deps: `@workspace/ui`, `@alkemart/shared`, `@alkemart/api-client`.

---

## File map (target app)

```
apps/storefront-mowafer/
  package.json                 # @workspace/storefront-mowafer, port 5176
  components.json              # shadcn New York (copy from storefront)
  vite.config.ts
  tsconfig.json
  index.html                   # Montserrat Google Fonts
  vitest.config.ts
  src/
    main.tsx
    styles/index.css           # tokens from spec 02
    design/brand.ts
    design/SPINE.md            # regenerated from clone pack
    lib/
      utils.ts
      api.ts                   # thin wrappers over @alkemart/api-client
      products.ts              # ProductCard / PeerOffer types + formatters
      cart.ts
      auth.ts
      catalog-nav.ts           # dept order, rail cap 6
    components/
      ui/                      # local shadcn adds: slider, radio-group, sheet, toggle-group
      shell/
        AppHeader.tsx
        CategoryIconRail.tsx
        AppFooter.tsx
        BottomTabBar.tsx
        BrandLogo.tsx
      home/
        CategoryMosaic.tsx
        LastOffers.tsx
        DeliveryBand.tsx
        AdvertiseBand.tsx
      listing/
        ListingHero.tsx
        ListingFilterStrip.tsx
        ListingSidePanels.tsx
        ListingLayout.tsx
      product/
        ProductCard.tsx
        ProductGallery.tsx
        BuyPanel.tsx
        PeerOffersList.tsx
        StickyBuyBar.tsx
      cart/
        CartTable.tsx
      checkout/
        CheckoutStepper.tsx
        AddressStep.tsx
        DeliveryStep.tsx
        PaymentStep.tsx
        SuccessStep.tsx
    routes/
      __root.tsx
      index.tsx
      categories.$slug.tsx
      product.$id.tsx
      cart.tsx
      checkout.tsx
      search.tsx
      shops.$slug.tsx
      shops.index.tsx
      login.tsx
```

Root workspace changes:

- `package.json` workspaces += `apps/storefront-mowafer`
- scripts: `dev:storefront-mowafer`

---

### Task 0: Scaffold `apps/storefront-mowafer` + tokens

**Files:**
- Create: `apps/storefront-mowafer/package.json`
- Create: `apps/storefront-mowafer/vite.config.ts`
- Create: `apps/storefront-mowafer/tsconfig.json`
- Create: `apps/storefront-mowafer/components.json`
- Create: `apps/storefront-mowafer/index.html`
- Create: `apps/storefront-mowafer/vitest.config.ts`
- Create: `apps/storefront-mowafer/src/main.tsx`
- Create: `apps/storefront-mowafer/src/styles/index.css`
- Create: `apps/storefront-mowafer/src/design/brand.ts`
- Create: `apps/storefront-mowafer/src/lib/utils.ts`
- Create: `apps/storefront-mowafer/src/routes/__root.tsx`
- Create: `apps/storefront-mowafer/src/routes/index.tsx`
- Create: `apps/storefront-mowafer/src/lib/__tests__/tokens.test.ts`
- Modify: `package.json` (root workspaces + `dev:storefront-mowafer`)

**Interfaces:**
- Consumes: existing workspace packages
- Produces: runnable app on `http://127.0.0.1:5176` with CSS vars `--primary`, `--foreground`, `--dept-*`

- [ ] **Step 1: Register workspace and package**

Add to root `package.json`:

```json
"dev:storefront-mowafer": "bun run --filter @workspace/storefront-mowafer dev"
```

and include `"apps/storefront-mowafer"` in `workspaces`.

Create `apps/storefront-mowafer/package.json` modeled on `apps/storefront/package.json` with:

- `"name": "@workspace/storefront-mowafer"`
- `"dev": "vite --config vite.config.ts --host 0.0.0.0 --port 5176"`
- deps: `@alkemart/api-client`, `@alkemart/shared`, `@workspace/ui`, React 19, TanStack Router/Query, Phosphor, CVA, clsx, tailwind-merge
- Add Radix packages needed later: `@radix-ui/react-slider`, `@radix-ui/react-radio-group`, `@radix-ui/react-toggle-group`, `@radix-ui/react-dialog` (sheet)

- [ ] **Step 2: Copy Vite/TS/shadcn scaffolding**

Copy and adjust from `apps/storefront`:

- `vite.config.ts` — change port comments to `5176`; keep TanStack router plugin paths under this app; **omit PWA** for v1 lab (YAGNI until cutover)
- `tsconfig.json`, `components.json` (aliases `@/` → this app `src`)
- `index.html` — load Montserrat 400/600/700 (not Sora)

- [ ] **Step 3: Write failing token test**

```ts
// src/lib/__tests__/tokens.test.ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("mowafer tokens", () => {
  const css = readFileSync(
    resolve(import.meta.dirname, "../../styles/index.css"),
    "utf8",
  )

  it("defines primary yellow and dark ink", () => {
    expect(css).toMatch(/--primary:\s*#febf31/i)
    expect(css).toMatch(/--foreground:\s*#3c3c3b/i)
  })

  it("defines department accents", () => {
    expect(css).toMatch(/--dept-electronics:\s*#50d1c8/i)
    expect(css).toMatch(/--dept-home-pet:\s*#f0295a/i)
    expect(css).toMatch(/--dept-beverages:\s*#9ac63b/i)
  })

  it("bans cream primary washes in CSS comments contract", () => {
    expect(css).toMatch(/no bg-primary\/N/i)
  })
})
```

- [ ] **Step 4: Run test — expect FAIL**

```bash
cd apps/storefront-mowafer && bun run test -- src/lib/__tests__/tokens.test.ts
```

Expected: FAIL (missing file / missing tokens)

- [ ] **Step 5: Implement tokens + minimal shell**

In `src/styles/index.css`:

```css
@import "tailwindcss";
@source "../";
@source "../../../../packages/ui/src";

@theme inline {
  --font-sans: "Montserrat", ui-sans-serif, system-ui, sans-serif;
  --radius-md: 12px;
  --radius-lg: 16px;
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-ring: var(--ring);
}

:root {
  /* Mowafer guidelines — see docs/research/mowafer-behance-clone/02-design-tokens-and-primitives.md
     Contract: gold/yellow is CTA only; no bg-primary/N washes. */
  --primary: #febf31;
  --primary-foreground: #000000;
  --foreground: #3c3c3b;
  --background: #ffffff;
  --card: #ffffff;
  --border: #e8e8e6;
  --muted: #f5f5f5;
  --muted-foreground: #5c5c5c;
  --ring: #febf31;
  --dept-electronics: #50d1c8;
  --dept-food: #febf31;
  --dept-home-pet: #f0295a;
  --dept-beverages: #9ac63b;
  --dept-health: #3c3c3b;
  --dept-baby: #f5f5f5;
}
```

Minimal `__root.tsx` + `index.tsx` rendering “Alkemart · Mowafer lab” with `bg-background text-foreground` and a `bg-primary text-primary-foreground` pill button.

- [ ] **Step 6: Install, typecheck, retest, smoke**

```bash
bun install
cd apps/storefront-mowafer && bun run test && bun run typecheck
bun run --filter @workspace/storefront-mowafer dev
```

Expected: tests PASS; typecheck PASS; `5176` serves shell.

- [ ] **Step 7: Commit**

```bash
git add package.json apps/storefront-mowafer
git commit -m "feat(storefront-mowafer): scaffold app with Mowafer tokens"
```

**Exit criteria (spec 02):** typecheck green; primary/dept tokens visible; Montserrat loaded.

---

### Task 1: Global chrome — header, category rail, footer

**Files:**
- Create: `src/components/shell/BrandLogo.tsx`
- Create: `src/components/shell/AppHeader.tsx`
- Create: `src/components/shell/CategoryIconRail.tsx`
- Create: `src/components/shell/AppFooter.tsx`
- Create: `src/lib/catalog-nav.ts`
- Create: `src/lib/__tests__/catalog-nav.test.ts`
- Create: `src/components/shell/__tests__/CategoryIconRail.test.tsx`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: tokens; `@workspace/ui` `Button` `Input` `DropdownMenu`
- Produces: `MARKET_DEPARTMENT_ORDER` (max 6 for rail); chrome in root layout

- [ ] **Step 1: Failing tests for rail cap + order**

```ts
// src/lib/__tests__/catalog-nav.test.ts
import { describe, expect, it } from "vitest"
import { RAIL_DEPARTMENT_ORDER, capRailDepartments } from "../catalog-nav"

describe("catalog-nav", () => {
  it("caps rail at 6", () => {
    const many = RAIL_DEPARTMENT_ORDER.concat(["pet-care", "other"] as never[])
    expect(capRailDepartments(many).length).toBeLessThanOrEqual(6)
  })

  it("keeps food last among core six", () => {
    expect(RAIL_DEPARTMENT_ORDER.at(-1)).toBe("food-groceries")
  })
})
```

Align slug list with `@alkemart/shared` / existing storefront `catalog-nav.ts` — **copy the canonical order**, do not invent a new taxonomy.

- [ ] **Step 2: Run — expect FAIL**, then implement `catalog-nav.ts`

- [ ] **Step 3: Build chrome components per spec 03**

`AppHeader` slots: `BrandLogo` · wide search (`Input`, placeholder framing best price / sellers) · links `Home · Stores · Purchases` · account dropdown · cart link. **No** second Search button; **no** language switcher.

`CategoryIconRail`: Phosphor line icons + API labels when categories load; max 6 via `capRailDepartments`.

`AppFooter`: brand · category links · legal.

Wire into `__root.tsx` above/below `<Outlet />`.

- [ ] **Step 4: Visual smoke**

```bash
bun run --filter @workspace/storefront-mowafer dev
```

Check desktop + 390px: header search dominates; rail under header; footer present.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront-mowafer
git commit -m "feat(storefront-mowafer): global chrome and category rail"
```

**Exit criteria (spec 03):** header/rail/footer acceptance boxes.

---

### Task 2: Home — mosaic → Last Offers → delivery → advertise

**Files:**
- Create: `src/components/home/CategoryMosaic.tsx`
- Create: `src/components/home/LastOffers.tsx`
- Create: `src/components/home/DeliveryBand.tsx`
- Create: `src/components/home/AdvertiseBand.tsx`
- Create: `src/components/product/ProductCard.tsx`
- Create: `src/components/home/__tests__/home-order.test.tsx`
- Create: `src/lib/products.ts`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: catalog API via `@alkemart/api-client`; `ProductCard` atom
- Produces: home course order locked in route JSX

- [ ] **Step 1: Failing order test**

```tsx
// Assert index route element order by data-section attributes
it("renders mosaic before last-offers before delivery before advertise", () => {
  // render <HomePage /> with mocked empty catalog
  const sections = screen.getAllByTestId(/section-/).map((n) => n.getAttribute("data-testid"))
  expect(sections).toEqual([
    "section-mosaic",
    "section-last-offers",
    "section-delivery",
    "section-advertise",
  ])
})
```

- [ ] **Step 2: Implement ProductCard**

Fact order: title · seller · price · rating (only if `ratingCount > 0`). Yellow add `Button`. Sizes: `tile | row` only.

Reuse types from existing storefront `lib/products.ts` where possible (copy, don’t import across apps).

- [ ] **Step 3: Implement home sections**

- Mosaic: asymmetric bento; broken art → glyph/shimmer
- LastOffers: **icon-only** tabs (not yellow text chips); sort caption; grid|list icons; centered `View More` pill (`Button` `rounded-full` outline)
- DeliveryBand: copy + CTA; no invented ETA minutes
- AdvertiseBand: yellow band → Sell on Alkemart form (`Input` + `Button`)

- [ ] **Step 4: Wire `index.tsx` with React Query catalog fetch**; honest empties via merchandising empty pattern from `@workspace/ui` if available

- [ ] **Step 5: Test + browser verify** (desktop + mobile)

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(storefront-mowafer): home course mosaic through advertise"
```

**Exit criteria (spec 04).**

---

### Task 3: PLP — hero, filter strip, coloured side panels

**Files:**
- Create: `src/components/ui/slider.tsx` (Radix)
- Create: `src/components/ui/radio-group.tsx`
- Create: `src/components/ui/toggle-group.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/listing/*` (hero, filter strip, side panels, layout)
- Create: `src/routes/categories.$slug.tsx`
- Create: `src/components/listing/__tests__/ListingSidePanels.test.tsx`
- Modify: `packages/ui` only if promoting shared primitives — prefer local `components/ui` first

**Interfaces:**
- Consumes: category slug param; catalog filters
- Produces: `ListingLayout` with desktop aside + mobile `Sheet`

- [ ] **Step 1: Add shadcn/Radix primitives** (`Slider` `RadioGroup` `ToggleGroup` `Sheet`) under `src/components/ui/` following existing `@workspace/ui` style (`cn`, CVA)

- [ ] **Step 2: Failing test — category panel uses dept accent class**

```tsx
it("applies department accent to categories panel", () => {
  render(<ListingSidePanels department="home-living" ... />)
  expect(screen.getByTestId("panel-categories").className).toMatch(/dept|home-pet|accent/)
})
```

- [ ] **Step 3: Implement listing chrome per spec 05**

Breadcrumb `Home / {Department}` · hero · filter strip (radios, rating, price slider, grid|list) · left Categories (accent) + Brands/Sellers (dark) · grid · View More. Mobile: panels in `Sheet`.

- [ ] **Step 4: Route `categories.$slug.tsx`** + search route reuse of layout where practical

- [ ] **Step 5: Verify no fake ratings**; empty filter options collapse

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(storefront-mowafer): PLP filters and department side panels"
```

**Exit criteria (spec 05 + 09 gaps for Slider/Radio/Sheet).**

---

### Task 4: PDP — gallery, buy panel, peer offers

**Files:**
- Create: `src/components/product/ProductGallery.tsx`
- Create: `src/components/product/BuyPanel.tsx`
- Create: `src/components/product/PeerOffersList.tsx`
- Create: `src/components/product/StickyBuyBar.tsx`
- Create: `src/routes/product.$id.tsx`
- Create: `src/components/product/__tests__/PeerOffersList.test.tsx`
- Create: `src/lib/__tests__/product-rating.test.ts`

**Interfaces:**
- Consumes: product detail + offers from API (`offerCount`, peer offers)
- Produces: `PeerOffersList({ offers, activeOfferId, onSelect })` — mirror existing storefront contract

- [ ] **Step 1: Failing tests**

```tsx
it("renders nothing when offers empty", () => {
  const { container } = render(<PeerOffersList offers={[]} activeOfferId={null} onSelect={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})

it("calls onSelect with offer id", async () => { /* ... */ })
```

```ts
it("formats rating only when count > 0", () => {
  expect(formatRating(4.9, 0)).toBeNull()
  expect(formatRating(4.9, 38)).toMatch(/4\.9/)
  expect(formatRating(4.9, 38)).toMatch(/38/)
})
```

- [ ] **Step 2: Implement PDP layout** — one price owner in `BuyPanel`; seller named; Specs/Reviews `Tabs` hide when empty; yellow Add to Cart + sonner toast

- [ ] **Step 3: Peer offers = Other Prices** — select updates active offer for ATC

- [ ] **Step 4: StickyBuyBar under 768px**

- [ ] **Step 5: Browser verify with real API product that has `offerCount > 1` when available; otherwise assert empty honesty**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(storefront-mowafer): PDP with peer seller offers"
```

**Exit criteria (spec 06).**

---

### Task 5: Cart + stepped checkout

**Files:**
- Create: `src/components/cart/CartTable.tsx`
- Create: `src/components/checkout/CheckoutStepper.tsx`
- Create: `src/components/checkout/{Address,Delivery,Payment,Success}Step.tsx`
- Create: `src/routes/cart.tsx`
- Create: `src/routes/checkout.tsx`
- Create: `src/lib/cart.ts`
- Create: `src/components/checkout/__tests__/CheckoutStepper.test.tsx`

**Interfaces:**
- Consumes: existing checkout API / Paystack paths from current storefront `lib` (copy adapt)
- Produces: step union `"address" | "delivery" | "payment" | "success"`

- [ ] **Step 1: Failing stepper test** — only one step panel visible; yellow marks current

- [ ] **Step 2: Cart table** — thumb · title · category colour tag · price · qty · subtotal; Place Order → `/checkout`

- [ ] **Step 3: Checkout machine** — Address → Delivery (shipping options; **no** fake time slots) → Payment (COD + Paystack; **no** points slider) → Success with Track/Orders CTA

- [ ] **Step 4: Wire auth gate only where API requires**; guest path if current API allows

- [ ] **Step 5: E2E-ish manual**: add → cart → address → delivery → payment mock/sandbox

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(storefront-mowafer): cart and stepped checkout"
```

**Exit criteria (spec 07).**

---

### Task 6: Mobile shell polish

**Files:**
- Create: `src/components/shell/BottomTabBar.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: listing/PDP for sheet + sticky buy already added
- Create: `src/components/shell/__tests__/BottomTabBar.test.tsx`

**Interfaces:**
- Consumes: router path for active tab
- Produces: tabs Home · Offers · Search · Account (≤5); cart stays in top bar

- [ ] **Step 1: Failing test** — four tabs render; Offers links to deals/home hash or `/search?deals=1` (pick one destination and document in SPINE)

- [ ] **Step 2: Implement `BottomTabBar`** `md:hidden`; pad `main` bottom safe area

- [ ] **Step 3: Verify 390px** — filters in sheet; sticky buy; toast on ATC; checkout single column

- [ ] **Step 4: Write `src/design/SPINE.md`** regenerated from clone pack (not the drifted production spine)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(storefront-mowafer): mobile bottom tabs and spine"
```

**Exit criteria (spec 08).**

---

### Task 7: Parity checklist + cutover prep (no traffic swap yet)

**Files:**
- Create: `apps/storefront-mowafer/CUTOVER.md`
- Modify: `docs/research/mowafer-behance-clone/00-MASTER.md` (link plan + note phase 7 pending)
- Optional: root script `dev:storefront-mowafer` already present

- [ ] **Step 1: Walk every acceptance checkbox in specs 02–08 against the running lab on 5176**; file gaps as issues in `CUTOVER.md`

- [ ] **Step 2: Document cutover steps in `CUTOVER.md`**

```markdown
1. Freeze features on apps/storefront
2. Point Pages/deploy script at storefront-mowafer build
3. Redirect 5175 → 5176 in local restart script after QA sign-off
4. Archive or rename old storefront only after 48h soak
```

- [ ] **Step 3: Do not swap production deploy in this task** unless explicitly requested after QA

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(storefront-mowafer): cutover checklist after parity"
```

**Exit criteria (spec 10 phase 7 prep):** checklist written; production untouched.

---

## Spec coverage self-check

| Spec file | Task |
|-----------|------|
| 00 MASTER rebuild gate | Tasks 0–7 |
| 01 IA / journeys | Tasks 2–5 routes |
| 02 tokens | Task 0 |
| 03 chrome | Task 1 |
| 04 home | Task 2 |
| 05 PLP | Task 3 |
| 06 PDP | Task 4 |
| 07 cart/checkout | Task 5 |
| 08 mobile | Task 6 |
| 09 shadcn gaps | Task 3 (+ Button/Input reuse throughout) |
| 10 adaptations / honesty | Global constraints + Tasks 2–5 |

## Placeholder scan

No TBD/TODO left in tasks; scaffold path fixed to `apps/storefront-mowafer` port `5176`.
