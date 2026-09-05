# Marketplace Visual Hierarchy Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkbox syntax for tracking.

**Goal:** Real Walmart-style multi-vendor hierarchy across chrome, home, PLP, and product tiles — not cosmetic token swaps.

**Architecture:** Token-driven design system already has True Blue / Spark Yellow. This plan fixes structural hierarchy: PLP IA, product card trust stack, category routing, filter copy, results toolbar.

**Tech Stack:** React, TanStack Router, Tailwind v4 tokens in `index.css`, existing shop components under `artifacts/alkemart/src/components/shop/`.

---

### Task 1: PLP browse page structure

**Files:**
- Modify: `artifacts/alkemart/src/routes/_shop.browse.$slug.tsx`

- [x] Replace loud blue hero with quiet title + count toolbar
- [x] Sticky white filter card on gray canvas
- [x] Ghana-local filter groups
- [x] Results grid + empty state hierarchy

### Task 2: Product card multi-vendor trust stack

**Files:**
- Modify: `artifacts/alkemart/src/components/shop/product-card.tsx`
- Modify: `artifacts/alkemart/src/components/shop/rating-stars.tsx`
- Modify: `artifacts/alkemart/src/components/shop/product-rail.tsx`

- [x] Brand / sold-by line
- [x] Default shipping meta
- [x] Consistent add CTA styling

### Task 3: Category tiles + homepage density

**Files:**
- Modify: `artifacts/alkemart/src/components/shop/category-tile.tsx`
- Modify: `artifacts/alkemart/src/components/shop/homepage-sections.tsx` (as needed)

- [x] Real browse links via TanStack Router

### Task 4: Verify in browser

- [x] Header blue, yellow search
- [x] Home modules
- [x] Browse PLP hierarchy
