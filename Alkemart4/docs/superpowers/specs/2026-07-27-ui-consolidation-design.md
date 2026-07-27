# UI Consolidation — Design Doc

## Goal

Eliminate all hardcoded values across storefront, admin, and vendor surfaces. Every color, radius, and spacing comes from CSS design tokens via `@workspace/ui` components. No `text-green-600`, no `bg-[#080807]`, no raw `<select>` — just token-driven shared components.

## Approach

**5 parallel workstreams** — each edits disjoint files:

### Workstream A: Design Tokens

- Fix 6 CSS/JS mismatches between `tokens.ts` and CSS vars (CSS wins as source of truth)
- Add `--color-success`/`--color-warning` to all 3 CSS `@theme` blocks
- Add missing `@theme` registrations: `--color-card-foreground` (admin), `--radius-2xl`/`--radius-3xl` (admin/vendor)
- Sync admin CSS with vendor (add `@custom-variant dark`, `100dvh`, `--surface-cream`)
- Delete `tokens.ts` — migrate its consumers to CSS vars via Tailwind
- Fix `brand.ts` to remove `brandDark` inconsistency with `ink`

### Workstream B: Shared UI Package

- Fix `Badge`: `success`/`warning` → semantic tokens, add `forwardRef`, change `text-xs` → `text-sm`
- Fix `CardTitle`: `HTMLParagraphElement` → `HTMLHeadingElement`
- Fix `Modal`: export `ModalTrigger`/`ModalClose`, use token-based overlay color
- Add `tailwindcss-animate` to package.json
- **Build new components** (from scratch, Radix-based): `Skeleton`, `Checkbox`, `Textarea`, `Switch`, `Tabs`
- Move storefront's `Price`, `EmptyState`, `Breadcrumbs`, `Container`, `Skeleton` into shared package
- Sync to backend copy

### Workstream C: Storefront

- Replace all `[ink]` arbitrary values with proper tokens
- Replace all `rgba(254,191,49,...)` and `rgba(255,255,255,...)` hardcoded colors
- Replace `#080807` hardcoded hex with CSS var
- Create shared local components: `GlassCard`, `SkipLink`, `ErrorAlert`, `OrderSummary`, `BottomBar`, `ProductThumbnail`
- Align `FormField` with `@workspace/ui/Input` (`h-12` → `h-10`, `rounded-xl` → `rounded-lg`)
- Replace raw `<a>` skip-link with `SkipLink` component
- Replace raw `<div>` avatar with `Avatar` component
- Replace raw `<button>` tabs with `Tabs` from `@workspace/ui`
- Replace raw `<select>` with `Select` from `@workspace/ui`
- Replace raw `<img>` with shared `ProductThumbnail`
- Deduplicate: OrderSummary (2 copies → 1), BottomBar (3 copies → 1), ErrorAlert (4 copies → 1), parseList, email lookup form
- Standardize Button radius overrides across all routes
- Extract all hardcoded text to constants

### Workstream D: Admin Dashboard

- Replace raw `<select>` with `Select` component
- Replace raw `<label>` with `Label` component
- Replace raw `<span>` badges with `Badge` component
- Replace `window.confirm`/`alert()` with Modal/AlertDialog
- Add skeleton loading states to 4 pages
- Add error states to 4 pages
- Wire mutation loading states to button disabled
- Add responsive sidebar collapse
- Add pagination to orders page
- Wire in i18n (infrastructure exists, zero usage)
- Create `PageHeader` + `PageShell` shared components
- Sidebar: replace `text-white`/`border-white/10` with token equivalents

### Workstream E: Vendor Dashboard

- Add `--color-success`/`--color-warning` to CSS `@theme` (blocked on A)
- Replace raw `<table>` with shared `Table` component
- Replace hardcoded green/yellow in settings with tokens
- Fix mobile logout (add button to mobile tab bar)
- Remove duplicate `memberMe` method
- Add error states to dashboard, products, orders pages
- Add skeleton loading (replace text "Loading...")
- Add pagination to orders/products
- Add sales chart from API `series` data
- Fix SVG typo + remove unused imports
- Create `PageHeader` + `PageShell` (matches admin pattern)
- Quick Sell: add `category_id` + `quantity` fields
- Sidebar: replace `text-white`/`border-white/10` with token equivalents

## Design Decisions

1. **CSS vars are the single source of truth** — `tokens.ts` is deleted. Tailwind `@theme` + `:root` define all values.
2. **One `@workspace/ui`** — the root copy is canonical; backend copy is a build artifact kept in sync.
3. **Storefront `h-12` → `h-10`** — aligns with `@workspace/ui/Input` defaults. Admin/vendor already use `h-10`.
4. **Storefront `rounded-xl` → `rounded-lg` on inputs** — aligns with `@workspace/ui/Input` defaults.
5. **New components are Radix-based** — follows existing pattern (Modal uses Radix Dialog, Avatar uses Radix Avatar).
6. **Toast via `sonner`** — lightweight, no Radix dependency, used in similar Medusa dashboards.
7. **Sidebar collapsible** — via state toggle with `w-64` ↔ `w-16` transition, same pattern as shadcn sidebar.

## Files Changed

~65 files across 5 workstreams. See `UI-AUDIT-FULL.md` for exhaustive per-file findings.
