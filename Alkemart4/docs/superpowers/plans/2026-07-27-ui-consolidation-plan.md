# UI Consolidation Implementation Plan

> **For agentic workers:** This plan has 5 independent workstreams (A-E) that edit disjoint files. Each workstream can be dispatched to a separate agent in parallel.

**Goal:** Eliminate all hardcoded values across storefront, admin, and vendor. Every color, radius, and spacing comes from CSS design tokens via `@workspace/ui` components.

**Architecture:** CSS `:root` vars + Tailwind `@theme` are the single source of truth. `@workspace/ui` provides all shared components. Each surface consumes both. Fix bottom-up: tokens → shared components → surfaces.

**Tech Stack:** Tailwind v4, Radix UI primitives, `sonner` for toasts, `lucide-react` for icons

## Global Constraints

- CSS vars in `:root` are the single source of truth — no JS color constants
- All colors in component code must use Tailwind utility classes referencing CSS vars ONLY — no hex, no rgb(), no tailwind color literals (no `green-500`, `yellow-100`, etc.)
- No `text-xs` anywhere — 14px (`text-sm`) is the minimum font size for UI
- All `@workspace/ui` components use `React.forwardRef`
- No `window.confirm` or `alert()` — use Modal/AlertDialog
- All new components are Radix-based where an appropriate Radix primitive exists
- Toast feedback uses `sonner` library
- `packages/ui/src/index.ts` must export every public component
- The root `packages/ui/` is canonical; `apps/backend/packages/ui/` must be synced after any change
- No inline `<style>` tags or arbitrary `style={{}}` props for colors

---

## Workstream A: Design Tokens

**Files:**
- Modify: `apps/storefront/src/styles/index.css`
- Modify: `apps/backend/apps/admin/src/styles/index.css`
- Modify: `apps/backend/apps/ghana-vendor/src/styles/index.css`
- Modify: `apps/storefront/src/design/tokens.ts`
- Modify: `apps/storefront/src/design/brand.ts`

### Task A1: Fix CSS token definitions across all 3 surfaces

- [ ] **Read all 3 CSS files** to understand current state
- [ ] **Add `--color-card-foreground` to admin `@theme`** — copy from storefront CSS:
      `--color-card-foreground: var(--card-foreground);`
- [ ] **Add `--color-success` and `--color-warning` to ALL 3 CSS `@theme` blocks:**
      `--color-success: #16a34a;` (green-600)
      `--color-warning: #d97706;` (amber-600)
- [ ] **Add `--color-success-foreground` and `--color-warning-foreground`:**
      `--color-success-foreground: #ffffff;`
      `--color-warning-foreground: #ffffff;`
- [ ] **Add `--radius-2xl` and `--radius-3xl` to admin and vendor CSS:**
      `--radius-2xl: 20px;`
      `--radius-3xl: 24px;`
- [ ] **Sync admin CSS with vendor**: add `@custom-variant dark`, `100dvh` body rules, `--surface-cream`
- [ ] **Remove hardcoded CSS color values** from storefront CSS:
      - Replace `rgba(254,191,49,0.2)` with `color-mix(in srgb, var(--primary) 20%, transparent)`
      - Replace `#080807` with `var(--ink)`
      - Replace `rgba(0,0,0,0.15)` in mosaic-scrim with `color-mix(in srgb, var(--ink) 15%, transparent)`
- [ ] **Verify**: `grep -rn "rgba\|#[0-9a-fA-F]\{6\}\|#[0-9a-fA-F]\{3\}" apps/*/src/styles/index.css | grep -v "var(--"` — should only show token definitions

### Task A2: Fix JS token file

- [ ] **Delete `apps/storefront/src/design/tokens.ts`** — CSS vars are the source of truth
- [ ] **Update `apps/storefront/src/design/index.ts`** to remove the deleted export
- [ ] **Update `apps/storefront/src/design/brand.ts`** — remove `brandDark` property (use `ink` instead)
- [ ] **Find all imports of `tokens.ts`** and update them:
      ```bash
      grep -rn "from.*design/tokens\|from.*design.*color\|from.*design.*space\|from.*design.*radius\|from.*design.*typography" apps/storefront/src/
      ```
- [ ] **Update each consumer** to use Tailwind classes or CSS vars directly instead of JS token references

---

## Workstream B: Shared UI Package

**Files:**
- Modify: `packages/ui/src/badge.tsx`
- Modify: `packages/ui/src/card.tsx`
- Modify: `packages/ui/src/modal.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/src/skeleton.tsx`
- Create: `packages/ui/src/checkbox.tsx`
- Create: `packages/ui/src/textarea.tsx`
- Create: `packages/ui/src/switch.tsx`
- Create: `packages/ui/src/tabs.tsx`
- Create: `packages/ui/src/toast.tsx`
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/separator.tsx`
- Create: `packages/ui/src/dropdown-menu.tsx`
- Move from storefront: `packages/ui/src/price.tsx`
- Move from storefront: `packages/ui/src/breadcrumbs.tsx`
- Move from storefront: `packages/ui/src/container.tsx`
- Move from storefront: `packages/ui/src/empty-state.tsx`
- Sync: `apps/backend/packages/ui/` (copy all changed files)

### Task B1: Fix existing components

- [ ] **Read Badge, Card, Modal, index.ts** to understand current code
- [ ] **Fix `badge.tsx`**:
  - Replace `success` variant: `bg-green-100 text-green-800` → `bg-success text-success-foreground`
  - Replace `warning` variant: `bg-yellow-100 text-yellow-800` → `bg-warning text-warning-foreground`
  - Change `text-xs` → `text-sm` (14px floor rule)
  - Wrap in `React.forwardRef<HTMLDivElement, BadgeProps>`
  - Update `BadgeProps` to include `className` passthrough
- [ ] **Fix `card.tsx`**:
  - Change `CardTitle` ref type from `HTMLParagraphElement` to `HTMLHeadingElement`
- [ ] **Fix `modal.tsx`**:
  - Add `"use client"` directive
  - Replace overlay `bg-black/50` with `bg-ink/50` (uses `--ink` token)
  - Export `ModalTrigger` and `ModalClose` at component level
  - Add `tailwindcss-animate` to `package.json` dependencies
- [ ] **Fix `index.ts`**:
  - Add exports: `ModalTrigger`, `ModalClose`, and all new components from B2
- [ ] **Run `tsc --noEmit`** in `packages/ui/` to verify no type errors

### Task B2: Build new components

- [ ] **Create `skeleton.tsx`**:
  ```tsx
  import { cn } from "./cn"
  
  function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />
  }
  export { Skeleton }
  ```
- [ ] **Create `checkbox.tsx`** (Radix-based with `@radix-ui/react-checkbox`):
  ```tsx
  import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
  import { cn } from "./cn"
  import { Check } from "lucide-react"
  
  const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
  >(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ))
  export { Checkbox }
  ```
- [ ] **Create `textarea.tsx`**:
  ```tsx
  import { cn } from "./cn"
  
  const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  )
  export { Textarea }
  ```
- [ ] **Create `switch.tsx`** (Radix-based with `@radix-ui/react-switch`):
  ```tsx
  import * as SwitchPrimitives from "@radix-ui/react-switch"
  import { cn } from "./cn"
  
  const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
  >(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitives.Root>
  ))
  export { Switch }
  ```
- [ ] **Create `tabs.tsx`** (Radix-based with `@radix-ui/react-tabs`):
  ```tsx
  import * as TabsPrimitive from "@radix-ui/react-tabs"
  import { cn } from "./cn"
  
  const Tabs = TabsPrimitive.Root
  const TabsList = React.forwardRef<..., ...>(({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn("inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)} {...props} />
  ))
  const TabsTrigger = React.forwardRef<..., ...>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger ref={ref} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} {...props} />
  ))
  const TabsContent = React.forwardRef<..., ...>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)} {...props} />
  ))
  export { Tabs, TabsList, TabsTrigger, TabsContent }
  ```
- [ ] **Add `@radix-ui/react-checkbox`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `sonner` to `package.json`**
- [ ] **Verify**: `cd packages/ui && tsc --noEmit` passes

### Task B3: Move storefront primitives into shared package

- [ ] **Copy storefront's `Price` component** into `packages/ui/src/price.tsx`:
  - Keep the `amount`/`currency`/`className` API
  - Remove any hardcoded colors — use `text-muted-foreground`, `text-foreground` tokens
- [ ] **Copy storefront's `Container` component** into `packages/ui/src/container.tsx`
- [ ] **Copy storefront's `EmptyState`** into `packages/ui/src/empty-state.tsx` — generic, no illustration dependency
- [ ] **Copy storefront's `Breadcrumbs`** into `packages/ui/src/breadcrumbs.tsx`
- [ ] **Update storefront imports** to use `@workspace/ui` versions instead of local
- [ ] **Update admin/vendor imports** to use new shared components where applicable
- [ ] **Update `index.ts`** to export all new components
- [ ] **Sync backend copy**: `cp -r packages/ui/src/* apps/backend/packages/ui/src/`

---

## Workstream C: Storefront

**Files:** 40+ files in `apps/storefront/src/`

### Task C1: Fix hardcoded colors in components

- [ ] **Fix `search.tsx`**: Replace `text-[ink]` → `text-foreground`, `bg-white/95` → `bg-background/95`, `shadow-black/5` → `shadow-ink/5`
- [ ] **Fix `delivery.tsx`**:
  - Replace `rgba(254,191,49,0.12)` → `color-mix(in srgb, var(--primary) 12%, transparent)` (via arbitrary value `[color-mix(in_srgb,var(--primary)_12%,transparent)]`)
  - Replace `rgba(255,255,255,0.06)` pattern → create local `GlassCard` component
  - Replace `ring-offset-[#080807]` → `ring-offset-ink`
- [ ] **Fix `account.tsx`**: Replace `text-white/65` → `text-ink/65`, `border-white/25` → `border-ink/25`
- [ ] **Fix `shops.$slug.tsx`**: Replace `text-white/70` → same pattern
- [ ] **Fix `AppFooter.tsx`**: Replace `text-white/80` → `text-ink/80` via `[color-mix(in_srgb,var(--ink)_80%,transparent)]`
- [ ] **Fix `auth-split-layout.tsx`**: Replace `bg-primary/25` decorative pattern
- [ ] **Fix `product.$id.tsx`**: Replace `bg-white` → `bg-card`

### Task C2: Fix hardcoded colors in routes

- [ ] **Fix `about.tsx`**: Replace decorative `bg-primary/20 blur-3xl` with token-based pattern
- [ ] **Fix `account.tsx` profile/avatar**: Replace hardcoded avatars with `Avatar` component
- [ ] **Review & fix ALL routes** from the audit report line-by-line

### Task C3: Create shared local components

- [ ] **Create `components/glass-card.tsx`**: Reusable glassmorphism card for delivery page
- [ ] **Create `components/skip-link.tsx`**: Accessible skip-to-content link
- [ ] **Create `components/error-alert.tsx`**: Reusable `bg-destructive/10 text-destructive p-4 rounded-md` pattern
- [ ] **Create `components/order-summary.tsx`**: Shared order summary sidebar (cart + checkout)
- [ ] **Create `components/bottom-bar.tsx`**: Shared fixed bottom action bar (cart + checkout + product)
- [ ] **Create `components/product-thumbnail.tsx`**: Shared product image with fallback

### Task C4: Replace raw HTML with shared components

- [ ] **Replace raw `<a>` skip-links** (2 copies) with `SkipLink` component
- [ ] **Replace raw `<img>` product thumbs** with `ProductThumbnail`
- [ ] **Replace raw `<button>` tabs** in `login.tsx` with `Tabs`
- [ ] **Replace raw `<select>`** in `checkout.tsx` with `Select` from `@workspace/ui`
- [ ] **Replace raw `<textarea>`** in `contact.tsx` with `Textarea` from `@workspace/ui`
- [ ] **Replace raw `<div>` avatars** with `Avatar` from `@workspace/ui`
- [ ] **Replace raw `<button>` accordion** in `help.tsx` with local `Accordion` or use details/summary

### Task C5: Align form field with shared Input

- [ ] **Modify `form-field.tsx`**:
  - Change `h-12` → `h-10`
  - Change `rounded-xl` → `rounded-lg`
  - Use `Input` from `@workspace/ui` as the base
- [ ] **Update `contact.tsx`** to use `form-field.tsx` instead of raw inputs
- [ ] **Verify**: Check `contact.tsx` focus ring matches `form-field.tsx`

### Task C6: Deduplicate patterns

- [ ] **Replace OrderSummary** (2 copies) with shared `OrderSummary` component
- [ ] **Replace BottomBar** (3 copies) with shared `BottomBar` component
- [ ] **Replace ErrorAlert** (4 copies) with shared `ErrorAlert` component
- [ ] **Replace `parseList`** (2 copies) with shared util
- [ ] **Replace `max-w-[1200px]`** with shared `Container` component usage
- [ ] **Remove redirect route files** that just re-export — use router redirects instead

### Task C7: Standardize Button radius

- [ ] **Audit all Button radius overrides**: `grep -rn "rounded-" apps/storefront/src/ --include="*.tsx" | grep -v "/node_modules/" | grep "Button"`
- [ ] **Remove non-standard radius overrides** on Buttons (keep only `rounded-full` where intentional for pills)

---

## Workstream D: Admin Dashboard

**Files:** 15+ files in `apps/backend/apps/admin/src/`

### Task D1: Replace raw HTML with shared components

- [ ] **Fix `orders.tsx:23-34`**: Replace raw `<select>` with `Select` from `@workspace/ui`
- [ ] **Fix `login.tsx:51,61`**: Replace raw `<label>` with `Label` from `@workspace/ui`
- [ ] **Fix `markets.tsx:52,56`**: Replace `<span>` badges with `Badge` from `@workspace/ui`
- [ ] **Fix `product-moderation.tsx:69`**: Replace raw `<img>` with `Avatar` or image component
- [ ] **Fix `product-moderation.tsx:144-150`**: Replace raw `<textarea>` with `Textarea` from `@workspace/ui`
- [ ] **Fix `sellers-queue.tsx:98-103`**: Same textarea fix

### Task D2: Fix hardcoded sidebar colors

- [ ] **Fix `Sidebar.tsx`**:
  - Replace `text-white` → `text-ink` (it's on dark bg, use primary-foreground)
  - Replace `border-white/10` → `border-ink/10`
  - Replace `text-white/70` → `text-ink/70`
  - Replace `hover:bg-white/10` → `hover:bg-ink/10`
  - Use `bg-ink` (already exists as token) instead of `bg-[--ink]`

### Task D3: Replace browser native dialogs

- [ ] **Fix `product-moderation.tsx`**: Replace `window.confirm()` → `Modal` from `@workspace/ui`
- [ ] **Fix `product-moderation.tsx`**: Replace `alert()` → inline error state via `ErrorAlert`
- [ ] **Fix `sellers-queue.tsx`**: Replace `window.confirm()` → `Modal` from `@workspace/ui`

### Task D4: Add missing UI states

- [ ] **Add skeleton loading to `markets.tsx`**: Replace `"Loading markets..."` with `Skeleton` components
- [ ] **Add skeleton loading to `orders.tsx`**: Replace `"Loading orders..."` with `Skeleton`
- [ ] **Add skeleton loading to `product-moderation.tsx`**: Replace `"Loading queue..."` with `Skeleton`
- [ ] **Add skeleton loading to `sellers-queue.tsx`**: Replace `"Loading seller queue..."` with `Skeleton`
- [ ] **Add error states**: To markets, orders, product-moderation, sellers-queue (show error banner + retry button)
- [ ] **Wire mutation loading**: Pass `isConfirming`/`isRejecting`/`isApproving`/`isSuspending` to button `disabled` prop in reject/approve modals

### Task D5: Wire i18n

- [ ] **Add i18n provider** to `main.tsx` using existing `i18n/index.ts`
- [ ] **Wire login page**: Use `t("login.title")` etc. from i18n
- [ ] **Wire admin nav**: Use i18n strings for sidebar labels

### Task D6: Create shared PageShell + PageHeader

- [ ] **Create `components/page-shell.tsx`**: Wraps `p-8 max-w-6xl mx-auto space-y-8`
- [ ] **Create `components/page-header.tsx`**: Wraps `h1 + p` subtitle pattern
- [ ] **Replace all 5 copies** in analytics, markets, orders, product-moderation, sellers-queue

### Task D7: Add pagination to orders

- [ ] **Add previous/next buttons** to `orders.tsx` using API's `offset` param
- [ ] **Add "Load more"** or page controls

### Task D8: Add responsive sidebar

- [ ] **Add collapse toggle** to `Sidebar.tsx`
- [ ] **Toggle width** between `w-64` and `w-16`
- [ ] **Show only icons** when collapsed

---

## Workstream E: Vendor Dashboard

**Files:** 15+ files in `apps/backend/apps/ghana-vendor/src/`

### Task E1: Fix hardcoded sidebar colors

- [ ] **Fix `layout.tsx`**:
  - Replace `text-white` → `text-primary-foreground` (since `primary-foreground` = `#1a1a1a` on dark bg, use appropriate token)
  - Replace `border-white/10` → `border-ink/10`
  - Replace `bg-white/10` → `bg-ink/10`
  - (All sidebar text is on `bg-ink` dark background)

### Task E2: Replace raw HTML with shared components

- [ ] **Fix `index.tsx`**: Replace raw `<table>` with `Table` from `@workspace/ui`
- [ ] **Fix `orders/index.tsx`**: Replace raw `<table>` with `Table` from `@workspace/ui`
- [ ] **Fix `layout.tsx:23`**: Replace raw `<div>` avatar with `Avatar` from `@workspace/ui`
- [ ] **Fix `quick-sell.tsx`**: Replace raw `<textarea>` with `Textarea` from `@workspace/ui`

### Task E3: Fix hardcoded colors in settings

- [ ] **Fix `settings.tsx`**:
  - Replace `text-green-600` → `text-success`
  - Replace `text-green-700` → `text-success`
  - Replace `bg-green-50 text-green-700 border-green-200` → `bg-success/10 text-success border-success/20`
  - Replace `bg-yellow-50 text-yellow-900 border-yellow-200` → `bg-warning/10 text-warning border-warning/20`

### Task E4: Fix broken success color in order detail

- [ ] **Fix `orders/$id.tsx:147,166,194`**: `bg-success` now works (we added `--color-success` in Workstream A)
- [ ] **Verify**: Step circles now have `bg-success text-white` background

### Task E5: Fix mobile logout

- [ ] **Add logout button to mobile tab bar** in `layout.tsx:79-97`
- [ ] **Use same `SignOut` icon + text pattern** as desktop sidebar

### Task E6: Add missing UI states

- [ ] **Add skeleton loading to dashboard** `index.tsx`: Replace `"..."` stat cards and `"Loading orders..."` with `Skeleton`
- [ ] **Add skeleton loading to `orders/index.tsx`**: Replace `"Loading orders..."` with `Skeleton`
- [ ] **Add error states**: To dashboard, products, orders list pages
- [ ] **Add pagination**: To orders and products pages
- [ ] **Add sales chart**: From API `series` data on dashboard

### Task E7: Create shared PageShell + PageHeader

- [ ] **Create `components/page-shell.tsx`**: Same pattern as admin
- [ ] **Create `components/page-header.tsx`**: Same pattern as admin
- [ ] **Replace all 6 copies** in index, products, orders/index, orders/$id, quick-sell, settings

### Task E8: Quick Sell improvements

- [ ] **Add `category_id` field** to Quick Sell form (select from API categories)
- [ ] **Add `quantity` field** to Quick Sell form (number input)
- [ ] **Fix operator precedence bug** in error condition: `upload.isError || quickSell.isError && (...)` → `(upload.isError || quickSell.isError) && (...)`

### Task E9: Fix minor bugs

- [ ] **Fix SVG typo** in `products.tsx`: `strokeLinelinejoin` → `strokeLinejoin`
- [ ] **Remove unused imports** in `products.tsx`: `Search`, `MoreVertical`
- [ ] **Remove duplicate `memberMe`** in `api.ts:376-377` (keep the `/alkemart/member/me` version)
