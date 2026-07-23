# Ghana-Vendor SPA Rebuild

**Goal:** Rewrite the ghana-vendor seller SPA from first principles — TanStack Router, TanStack Query, Tailwind v4 + shadcn/ui, `@mercurjs/client`, `@alkemart/shared`. No `@medusajs/ui` or Mercur UI constraints.

**Architecture:** Single-page application bundled with the API (same-origin, one deploy). Served at `/seller/`. Auth via session cookie + `/vendor/alkemart/me`.

**Routing:** TanStack Router, file-based under `src/routes/`.

**Data fetching:** TanStack Query with `@mercurjs/client` generated typed client. staleTime: 5min for list queries, 0 for mutations.

**UI:** Tailwind v4 + shadcn/ui components (Button, Card, Input, Table, Dialog). Brand tokens from `@alkemart/shared`. Lucide-react icons. No `@medusajs/ui`.

**Pages (8):**
- `/login` — Login form, auth mutation
- `/register` — Seller registration
- `/` — Dashboard (sales summary, recent orders, stats)
- `/quick-sell` — Create offer form
- `/products` — Product list (seller's products)
- `/orders` — Order list with filters
- `/orders/:id` — Order detail (line items, status timeline)
- `/settings` — Profile, address, payout info

**Auth flow:** Login via mutation → server sets session cookie → subsequent requests read `/vendor/alkemart/me` via useQuery → protected routes redirect to `/login`.

**Non-goals:** i18n, Sentry/PostHog, PWA, offline support.

## Implementation Plan

See `docs/superpowers/plans/2026-07-22-ghana-vendor-rebuild.md`.
