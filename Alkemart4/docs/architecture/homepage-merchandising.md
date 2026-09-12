# Homepage merchandising

The homepage is a constrained composition of reusable sections, managed from Admin → Homepage Studio.

Visual primitives live in `packages/ui/src/merchandising.tsx`. Both the admin preview and public storefront use these same components, preventing preview/render drift. Storefront-only adapters provide real category links and product cards around the shared grid and shelf primitives.

## Content lifecycle

- **Draft** is visible only to admins in the Studio preview.
- **Published** is the public snapshot.
- **Scheduled** stores a separate snapshot and activation time, so later draft edits do not alter a scheduled campaign.
- Writes use a revision number. A stale editor receives HTTP 409 instead of overwriting newer work.
- Publish and schedule operations are recorded in the admin audit log.

## Supported sections

- `promo_hero`: one strong seasonal message and action.
- `promo_grid`: two to four linked campaign tiles.
- `category_grid`: four, six, or eight real catalog categories.
- `product_shelf`: featured, latest, or category-scoped products.
- `value_grid`: two to four trust or service messages.

The storefront renders only validated internal links and real catalog entities. Missing categories and products are omitted; unpublished content falls back to the existing homepage.

## Deployment

Apply `packages/db/src/migrations/0018_content_pages.sql` before publishing through Homepage Studio.
