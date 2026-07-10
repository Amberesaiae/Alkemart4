# Alkemart

A multi-vendor marketplace app (Ghana-focused) with buyer storefront, vendor dashboards, and an admin panel for managing vendors, disputes, and homepage content.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/alkemart run dev` — run the storefront frontend (port 24668)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` (object storage, used for vendor image uploads)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, session-cookie auth, CASL for role-based authorization (`@workspace/abilities`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, TanStack Router (file-based routes in `src/routes`), Radix UI, TanStack Query
- Object storage: Google Cloud Storage (Replit App Storage) for vendor product/shop images

## Where things live

- `artifacts/alkemart` — storefront + vendor dashboard + admin panel frontend (TanStack Router, file-based routes)
- `artifacts/api-server` — Express API (`src/routes/*`: catalog, cart, auth, vendor, admin, homepage, conversations, images)
- `lib/db/src/schema` — Drizzle schema: users, user_roles, sessions, vendors, categories, products, carts/cart_items, homepage_sections, disputes, conversations/messages, images/image_upload_intents
- `lib/abilities` — CASL ability definitions shared between routes' `requireAbility` middleware
- `lib/api-spec/openapi.yaml` — source of truth for the API contract (source for codegen)

## Architecture decisions

- Roles are per-user and optionally per-vendor (`user_roles` table: buyer, vendor_owner, vendor_staff, admin, support_agent), enforced via CASL abilities rather than ad hoc role-string checks.
- Session auth uses signed cookies + a `sessions` table (no JWT).
- Vendor/product images go through a presigned-upload + moderation flow (`image_upload_intents` → `images`, admin approve/reject) rather than direct public uploads.

## Product

- Buyers: browse categorized homepage sections, view vendor storefronts and products, cart, checkout.
- Vendors: dashboard to manage their own shop and products.
- Admins: manage vendor approval status, disputes, homepage section content, and image moderation queue.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- New signups default to the `buyer` role. To reach the admin panel, insert a `user_roles` row with `role = 'admin'` for a user (no self-serve admin signup flow exists).
- The database starts empty after a fresh schema push. Run `pnpm --filter @workspace/scripts run seed-homepage` to seed vendors, categories, tagged products, and enabled homepage sections so the storefront isn't blank in dev. The script is idempotent (upserts by slug, truncates+rewrites homepage_sections).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
