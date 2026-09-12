# Homepage merchandising

The homepage is a constrained composition of reusable sections, managed from Admin → Homepage Studio.
It follows the Walmart grid-first order (banner → category tiles → product shelves → promo grids → band)
and Amazon Stores tile discipline (max 24 sections, 4-desktop / 2-mobile product grids, manual or
source-driven product selection).

Visual primitives live in `packages/ui/src/merchandising.tsx`. Both the admin preview and public storefront use these same components, preventing preview/render drift. Storefront-only adapters provide real category links and product cards around the shared grid and shelf primitives.

## Content lifecycle

- **Draft** is visible only to admins in the Studio preview.
- **Published** is the public snapshot.
- **Scheduled** stores a separate snapshot and activation time, so later draft edits do not alter a scheduled campaign.
- **Per-section** `visible` / `startsAt` / `endsAt` enables seasonal campaigns without republishing the whole page. The storefront filters with `visibleSections()`; the Studio dims out-of-window sections instead of hiding them.
- Writes use a revision number. A stale editor receives HTTP 409 instead of overwriting newer work.
- Publish and schedule operations are recorded in the admin audit log.

## Supported sections

- `promo_hero`: one strong seasonal message. Layouts: `split` (image beside copy) or `band` (full-width backdrop). Optional eyebrow, subtitle, action.
- `promo_grid`: 1–8 linked campaign tiles. Variants: `cards` (even grid) or `bento` (first tile featured, Amazon split-section pattern). Columns 2–4.
- `category_grid`: 0–16 real catalog categories. Variants: `tiles` (Walmart clarity), `mosaic` (bento feature), `rail` (compact scroll nav that can replace a heavy second header). Columns 4/6/8, optional “View all”.
- `product_shelf`: sources `featured` | `latest` | `category` | `manual` (explicit product IDs in order). Layouts `grid` (4 desktop / 2 mobile, Amazon product-grid rule) or `carousel` (scroll rail). Limits 4/8/12.
- `promo_band`: compact CTA strip (seller callout, delivery promise, seasonal notice). Manageable replacement for the old code-only `HomeAdvertiseBand`. Primary + secondary actions, theme, optional backdrop.
- `value_grid`: 2–4 trust or service messages.

Every section supports title/subtitle, theme (white/gold/black), internal-link + HTTPS-image validation, visibility toggle, and start/end dates. Missing categories and products are omitted with an honest empty state; unpublished content falls back to the existing homepage.

## Studio capabilities

- Section library (6 types) with per-type guidance hints.
- Live preview with the exact storefront components; desktop/mobile widths.
- Duplicate, move up/down, delete; section counter (n/24).
- Real category names in preview; shelf source warnings (missing category, empty manual picks).
- Hidden/scheduled badge; buyer-view note with storefront link.

## Deployment

Apply `packages/db/src/migrations/0018_content_pages.sql` before publishing through Homepage Studio.
No new migration was needed for the v2 section fields — they are JSONB-compatible additions validated by Zod at the API boundary.
