# Full UI Audit — Alkemart

## Design Token System (Foundation)

### CSS Variable vs JS Token Mismatch

| Token | CSS `:root` | JS `tokens.ts` | Winner |
|-------|------------|----------------|--------|
| `primaryForeground` | `#1a1a1a` | `#3C3C3B` | CSS (`#1a1a1a`) |
| `foreground` | `#2a2a2a` | `#3C3C3B` | CSS (`#2a2a2a`) |
| `mutedForeground` | `#3d3d3d` | `#8A8A8A` | CSS (`#3d3d3d`) |
| `border` | `#d4d4d4` | `#EBEBEB` | CSS (`#d4d4d4`) |
| `destructive` | `#c41e3a` | `#F0295A` | CSS (`#c41e3a`) |
| `radius.2xl` | `20px` | `24px` | CSS (`20px`) |
| `radius.3xl` | `24px` | `32px` | CSS (`24px`) |
| `ink` | `#1a1a1a` | **MISSING** | CSS — `color.ink` doesn't exist in JS |
| `brandDark` | n/a | `#3C3C3B` | **Dead code** — no CSS equivalent |

### Missing CSS `@theme` Registrations

| Token | Storefront | Admin | Vendor |
|-------|-----------|-------|--------|
| `--color-card-foreground` | ✅ | ❌ **MISSING** | ✅ |
| `--color-success` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| `--color-warning` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| `--radius-2xl` | ✅ (20px) | ❌ | ❌ |
| `--radius-3xl` | ✅ (24px) | ❌ | ❌ |
| `@custom-variant dark` | ❌ | ❌ | ✅ |
| `100dvh` body | ❌ | ❌ | ✅ |
| `--surface-cream` | ✅ | ❌ | ✅ |

### Hardcoded Colors in CSS Files

- **Storefront** `index.css`: `rgba(254,191,49,0.2)` (delivery-glow), `rgba(254,191,49,0.35)` (listing-hero), `#080807` (delivery-page bg), `#5a5a5a` (brands-panel), `#ffffff` (site-footer text), 9 department theme classes with 3 hardcoded hex values each
- **Admin** `index.css`: `surface-cream` missing
- **Vendor** `index.css`: `--surface-cream` defined but NOT in `@theme` (unreachable)

---

## Shared UI Package (`@workspace/ui`)

### Critical Bugs

| Component | Issue | File:Line |
|-----------|-------|-----------|
| `Badge` | `success` variant uses `bg-green-100 text-green-800` — not themeable | `badge.tsx:14` |
| `Badge` | `warning` variant uses `bg-yellow-100 text-yellow-800` — not themeable | `badge.tsx:15` |
| `Badge` | Uses `text-xs` (12px) — violates 14px floor | `badge.tsx` |
| `Badge` | Not using `forwardRef` — inconsistent with all other components | `badge.tsx` |
| `CardTitle` | Ref typed `HTMLParagraphElement` but renders `<h3>` — should be `HTMLHeadingElement` | `card.tsx:22` |
| `Modal` | Overlay uses `bg-black/50` — hardcoded, no token | `modal.tsx` |
| `Modal` | Uses `tailwindcss-animate` classes not listed as dependency | `modal.tsx` |
| `Modal` | `ModalTrigger`, `ModalClose` NOT exported from `index.ts` | `index.ts` |

### Missing High-Priority Components

| Component | Used in | Priority |
|-----------|---------|----------|
| `Skeleton` | Storefront has local, admin/vendor use inline pulse | **HIGH** |
| `Checkbox` | Used in storefront search facets, vendor settings | **HIGH** |
| `Textarea` | Used in admin reject modals, vendor quick-sell | **HIGH** |
| `Switch/Toggle` | Vendor settings, storefront preferences | **HIGH** |
| `Tabs` | Vendor settings/orders, admin orders, storefront login | **HIGH** |
| `DropdownMenu` | Storefront account menu, admin user menu | **MEDIUM** |
| `Separator` | All three surfaces | **MEDIUM** |
| `Toast/Sonner` | Needed everywhere for action feedback | **MEDIUM** |
| `Tooltip` | All three surfaces | **LOW** |
| `AlertDialog` | Replace `window.confirm` in admin | **MEDIUM** |
| `Breadcrumbs` | Storefront has local, admin/vendor missing | **MEDIUM** |

---

## Storefront Issues

### Hardcoded Colors (Sample — biggest violations)

| File | Line | Value | Should Use |
|------|------|-------|-----------|
| `search.tsx` | 163 | `text-[ink]/50` | `text-muted-foreground` or design token |
| `search.tsx` | 171 | `bg-white/95 text-[ink] shadow-lg shadow-black/5` | Token equivalents |
| `delivery.tsx` | 43 | `rgba(254,191,49,0.12)` | `primary` with opacity |
| `delivery.tsx` | 84,245 | `ring-offset-[#080807]` | CSS variable |
| `delivery.tsx` | 104,138,172,213 | `rgba(255,255,255,0.06)` pattern (5x) | Shared `GlassCard` component |
| `about.tsx` | 85 | `bg-primary/20 blur-3xl` | Decorative constant |
| `auth-split-layout.tsx` | 48 | `alkemart<span>.</span>` hardcoded | `brand.wordmarkHtml` |
| `AppFooter.tsx` | | `text-white/80`, `text-white/70` (11x) | Token with opacity |
| `account.tsx` | 235,250,264 | `text-white/65`, `text-white/55` | Token equivalent |
| `shops.$slug.tsx` | 163,168,184 | `text-white/70`, `text-white/55` | Token equivalent |

### Radius/Input Inconsistencies with `@workspace/ui`

| Storefront Component | Storefront Value | `@workspace/ui` Default | Impact |
|---------------------|-----------------|------------------------|--------|
| `form-field.tsx` input | `h-12 rounded-xl` | `h-10 rounded-lg` | Different size from admin/vendor |
| `not-found.tsx` Button | `rounded-xl` | `rounded-md` | Overrides Button default |
| `empty-state.tsx` Button | `rounded-none` | `rounded-md` | Inconsistent with Button spec |
| `ViewMore.tsx` | `rounded-full` | n/a | Pill pattern |
| `product-card.tsx` | `rounded-lg` | `rounded-xl` (Card) | Card radius mismatch |

### Duplicated Layout Patterns

| Pattern | Files | Copies |
|---------|-------|--------|
| Order summary sidebar | `cart.tsx:177`, `checkout.tsx:655` | 2 (different rounded) |
| Fixed bottom bar | `cart.tsx:213`, `checkout.tsx:702`, `product.$id.tsx:343` | 3 |
| Skip-link | `__root.tsx:168,253` | 2 |
| Error alert box `border-destructive/40 bg-destructive/5` | `cart.tsx:93`, `product.$id.tsx:198`, `categories.$slug.tsx:439`, `order.$id.tsx:153` | 4 |
| `parseList` | `search.tsx:23`, `categories.$slug.tsx:48` | 2 |
| Email lookup form | `order.$id.tsx:176,225` | 2 |
| Redirect routes | `signin.tsx`, `browse.$slug.tsx`, `sellers.tsx`, `store.$slug.tsx` | 4 |
| `max-w-[1200px]` hardcoded | Container, AppHeader, `__root.tsx`, search, CategoryIconRail | 5+ |
| `inputClass` (form styles) | `form-field.tsx:3`, `contact.tsx:318` | 2 (different focus rings!) |

### Missing UI States

| State | Routes Missing |
|-------|---------------|
| Loading skeleton | `help.tsx` (static), `about.tsx` (static), `contact.tsx`, `partners.tsx` |
| Error state | `help.tsx`, `about.tsx`, `partners.tsx` (all static pages — acceptable) |
| Inline i18n | **ALL routes** — ~200+ hardcoded strings, zero i18n usage |

### Raw HTML Elements That Should Use Shared Components

| Element | File | Should Use |
|---------|------|-----------|
| Raw `<a>` skip-link (2x) | `__root.tsx:168,253` | `SkipLink` component |
| Raw `<div>` avatar | `account.tsx:224`, `shops.$slug.tsx:152` | `Avatar` from `@workspace/ui` |
| Raw `<button>` tabs | `login.tsx:111` | `Tabs` component (missing) |
| Raw `<button>` accordion | `help.tsx:102` | `Accordion` component (missing) |
| Raw `<select>` | `checkout.tsx:614` | `Select` from `@workspace/ui` |
| Raw `<input>` (4+ files) | `orders.tsx`, `order.$id.tsx`, `contact.tsx`, `search.tsx` | `Input` or `FormField` |
| Raw `<textarea>` | `contact.tsx` | `Textarea` component (missing) |
| Raw `<img>` product thumbs | `cart.tsx`, `product.$id.tsx`, `order.$id.tsx` | Shared `ProductThumbnail` |
| `menu-link` local component | `__root.tsx:299` | Shared `NavLink` |
| `Chip` local component | `categories.$slug.tsx:491` | Shared `Chip` |
| `Step` local component | `sell.tsx:122` | Shared `StepIndicator` |
| `RoleCard` local component | `partners.tsx:103` | Shared `Card` pattern |
| `QuickLink`/`HelpHighlight` | `help.tsx:164,181` | Shared link/callout components |

---

## Admin Dashboard Issues

### Hardcoded Colors

| File | Line | Value | Should Use |
|------|------|-------|-----------|
| `Sidebar.tsx` | 19 | `text-white` | `text-ink` equivalent |
| `Sidebar.tsx` | 20,48 | `border-white/10` | `border-ink/10` |
| `Sidebar.tsx` | 38,51 | `text-white/70 hover:bg-white/10` | Token equivalents |
| `orders.tsx` | 23-34 | Raw `<select>` with inline classes | `Select` from `@workspace/ui` |
| `markets.tsx` | 52,56 | `<span>` with `bg-primary/10 border-primary/20` | `Badge` from `@workspace/ui` |
| `login.tsx` | 51,61 | Raw `<label>` | `Label` from `@workspace/ui` |

### Missing UI States

| State | Pages Missing |
|-------|--------------|
| Loading skeleton | `markets.tsx`, `orders.tsx`, `product-moderation.tsx`, `sellers-queue.tsx` |
| Error state | `markets.tsx`, `orders.tsx`, `product-moderation.tsx`, `sellers-queue.tsx` |

### Missing Features

| Feature | Details |
|---------|---------|
| i18n | Infrastructure exists (en.json, i18n/index.ts) but ZERO routes use it |
| `window.confirm` | `product-moderation.tsx:24`, `sellers-queue.tsx:21` — should use Modal |
| `alert()` error handling | `product-moderation.tsx:42` — should show inline error |
| Mutation loading unconnected | `isApproving`, `isSuspending`, `isConfirming`, `isRejecting` exist but never used on buttons |
| No pagination | `orders.tsx` hardcodes `limit: 50` |
| No responsive sidebar | `w-64` fixed, no collapse on < 1024px |
| No toast/notifications | No success feedback after any action |
| README mismatch | Documents old routing convention, not TanStack Router |

---

## Vendor Dashboard Issues

### Hardcoded Colors

| File | Line | Value | Should Use |
|------|------|-------|-----------|
| `orders/$id.tsx` | 147,166,194 | `bg-success text-white` | `--color-success` **doesn't exist** — invisible! |
| `settings.tsx` | 303,317 | `text-green-600`, `text-green-700` | Themed success token |
| `settings.tsx` | 362 | `bg-yellow-50 text-yellow-900 border-yellow-200` | Themed warning token |
| `settings.tsx` | 408 | `bg-green-50 text-green-700 border-green-200` | Themed success token |
| `layout.tsx` | 21,42,51,54,80 | `bg-white/10`, `border-white/10` | Token equivalents |
| `layout.tsx` | 27,28,66,89 | `text-white`, `text-white/60`, `text-white/70` (8x) | Token equivalents |
| `login.tsx` | 24,28,29,32,33 | `text-white/60` | Token equivalents |
| `register.tsx` | 28,32,33,36,37 | `text-white/60` | Token equivalents |

### Critical Bugs

| Bug | File | Detail |
|-----|------|--------|
| `bg-success` won't resolve | `orders/$id.tsx:147,166,194` | `--color-success` NOT in `@theme` — step circles invisible |
| Mobile can't sign out | `layout.tsx:79-97` | Logout button only in desktop sidebar |
| Duplicate `memberMe` | `api.ts:376 vs 391` | First def `/vendor/members/me` overwritten by `/alkemart/member/me` |
| SVG typo | `products.tsx:115` | `strokeLinelinejoin` → `strokeLinejoin` |
| Unused imports | `products.tsx:4` | `Search`, `MoreVertical` never used |

### Raw HTML Elements That Should Use `@workspace/ui`

| File | Lines | Raw Element | Should Use |
|------|-------|-------------|-----------|
| `index.tsx` | 70-122 | `<table>` | `Table` from `@workspace/ui` |
| `orders/index.tsx` | 59-131 | `<table>` | `Table` from `@workspace/ui` |
| `layout.tsx:23` | 23 | `<div>` avatar | `Avatar` from `@workspace/ui` |
| `quick-sell.tsx` | 185-191 | `<textarea>` | `Textarea` (missing) |

### Missing Features

| Feature | Details |
|---------|---------|
| No error states on dashboard, products, orders list | API failures are silent |
| No pagination | Hardcoded `limit: 5` on dashboard, no "load more" |
| No search on orders/products | No text search input |
| No chart/sales viz | API returns `series` data, unused |
| Quick Sell missing fields | `category_id`, `quantity` supported by API but not in form |
| `window.confirm` | Not used (better than admin) but no toast either |

---

## Cross-Cutting Summary

### Actions Needed (by layer)

**Layer 0: Design Tokens**
1. Delete JS `tokens.ts` — CSS vars are the single source of truth
2. Fix 6 mismatched values between JS tokens and CSS
3. Add `--color-success` and `--color-warning` to all 3 CSS files
4. Add `--color-card-foreground` to admin CSS `@theme`
5. Sync admin CSS with vendor (add `@custom-variant dark`, `100dvh`, `--surface-cream`)
6. Merge duplicate `@workspace/ui` packages (root vs backend) into one

**Layer 1: Shared UI Components**
1. Fix Badge `success`/`warning` to use semantic tokens
2. Fix Badge to use `forwardRef` and respect 14px floor
3. Fix `CardTitle` ref type (`HTMLParagraphElement` → `HTMLHeadingElement`)
4. Fix Modal: export `ModalTrigger`/`ModalClose`, fix overlay color, add `tailwindcss-animate` dep
5. **Build**: `Skeleton`, `Checkbox`, `Textarea`, `Switch`, `Tabs`, `Toast` components
6. **Build**: `DropdownMenu`, `AlertDialog`, `Separator`, `Tooltip`
7. Move storefront's `Breadcrumbs`, `Price`, `Container`, `Skeleton`, `EmptyState` into shared package

**Layer 2: Storefront**
1. Replace all `[ink]` arbitrary values with proper tokens
2. Replace `delivery.tsx` hardcoded `rgba()` with token-based pattern
3. Create shared `GlassCard`, `SkipLink`, `ErrorAlert`, `OrderSummary`, `BottomBar`, `ProductThumbnail` components
4. Align `form-field.tsx` with `@workspace/ui/Input` (unify `h-12`/`h-10`, `rounded-xl`/`rounded-lg`)
5. Standardize Button radius overrides — use Card/Button defaults
6. Replace local tab/accordion/chip components with shared ones
7. Extract all hardcoded strings into i18n

**Layer 3: Admin Dashboard**
1. Replace raw `<select>` with `Select` component
2. Replace raw `<label>` with `Label` component
3. Replace raw `<span>` badges with `Badge` component
4. Replace `window.confirm`/`alert()` with Modal/AlertDialog
5. Add skeleton loading + error states to 4 pages
6. Wire mutation loading states to button disabled
7. Add responsive sidebar collapse
8. Add pagination to orders
9. Wire in i18n (infrastructure exists, zero usage)
10. Add toast feedback for actions
11. Create shared `PageHeader` + `PageShell` components

**Layer 4: Vendor Dashboard**
1. Add `--color-success` and `--color-warning` to CSS `@theme`
2. Replace raw `<table>` with shared `Table` component
3. Replace hardcoded green/yellow in settings with tokens
4. Fix mobile logout (add button to mobile tab bar)
5. Remove duplicate `memberMe` method
6. Add error states to dashboard, products, orders pages
7. Add pagination to orders/products
8. Add skeleton loading (replace text "Loading...")
9. Add sales chart from API `series` data
10. Add `category_id`/`quantity` to Quick Sell form
11. Fix SVG typo, remove unused imports
12. Create shared `PageHeader` + `PageShell` (matches admin)

**Layer 5: Cross-Cutting**
1. Unify login pages (admin uses light bg, vendor uses dark bg — different Card styles)
2. Unify sidebar styles (admin uses `bg-[--ink]`, vendor uses `bg-ink`)
3. Unify container widths (`max-w-[1200px]` vs `max-w-6xl` vs `max-w-5xl`)
4. Add consistent error boundary at root level
5. Add consistent 404 handling
6. Add `ReactQueryDevtools` in dev mode
