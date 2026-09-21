# Homepage merchandising

The storefront homepage is a **marketing course**, not a CMS dump: departments (goods first) → most ordered → multi-seller `from ¢X` proof → shop rail. Studio campaigns (hero, band, countdown) append after those beats. `composeMarketCourse()` in `@alkemart/shared/homepage` is what the public home renders.

The mosaic is the only department story on home. The old sticky chip bar under search is gone; that chip style is an in-page **category reel** on browse and search. Shop cards on the store rail show the vendor's featured goods, not only the banner.

The homepage is a constrained composition of reusable sections, managed from Admin → Homepage Studio.
Motion and keyframes for these primitives live in `packages/ui/src/merchandising.css`, imported by every app stylesheet so the storefront and Studio preview animate identically.

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
- `category_grid`: 1–16 **category banners**. Each tile names a catalogue category and carries its own art (`imageUrl`), crop (`focalPoint`), label, eyebrow, badge and `slot` (`feature` | `standard`); art falls back to the canonical category photography when unset. Variants: `mosaic` (two feature tiles beside a stack — the original homepage composition), `tiles` (even grid), `banner` (wide strips), `rail` (compact scroll nav). Proportions come from `ratio` (`square` | `landscape` | `wide` | `ultrawide`) — tiles are sized by aspect ratio, never a fixed height. Columns 4/6/8 outside mosaic, optional “View all”.

  The pre-banner `categoryIds: string[]` shape is still accepted on write and forward-migrated on read by `migrateSections()` (first two entries become feature tiles), so existing drafts and published snapshots keep rendering without a database migration.
- `product_shelf`: sources `featured` | `latest` | `category` | `manual` (explicit product IDs in order) plus **rule sources** `most_ordered` | `trending` | `daypart` | `near_me`. Layouts `grid` (4 desktop / 2 mobile, Amazon product-grid rule) or `carousel` (scroll rail). Limits 4/8/12. Rule sources fill themselves per buyer and hour; a rule that matches nothing renders empty rather than falling back to unrelated products.
- `store_rail`: a shelf of shops rather than products. Sources `top_rated` | `fastest` | `newest` | `near_me` | `manual` (shop handles in order). Limits 4/8/12.
- `promo_band`: compact CTA strip (seller callout, delivery promise, seasonal notice). Manageable replacement for the old code-only `HomeAdvertiseBand`. Primary + secondary actions, theme, optional backdrop.
- `countdown_banner`: a deal with a deadline. `countdownTo` drives a live clock that stops at zero and shows `expiredLabel`; pairing it with the section's `endsAt` removes the whole block at the same moment. The deadline, not the ticking digits, is what assistive tech announces.
- `marquee`: 1–8 short announcements. `animated` is opt-in, ships with a pause control, and `prefers-reduced-motion` renders it as a static wrapped strip — WCAG 2.2.2 compliance for auto-moving content.
- `deal_rail`: campaign framing (eyebrow, per-card `badge`, optional header clock) over the same product sources as `product_shelf`. It deliberately shows **no discount percentage or stock meter**: the catalogue carries no compare-at price or inventory count, so either would be an unsubstantiated claim. Adding a compare-at price to the offer model is the prerequisite for real "% off".
- `value_grid`: 2–4 trust or service messages.

Every section supports title/subtitle, theme (white/gold/black), internal-link + HTTPS-image validation, visibility toggle, and start/end dates. Missing categories and products are omitted with an honest empty state; unpublished content falls back to the existing homepage.

## Studio capabilities

The Studio is a three-zone workbench under a sticky command bar (title, status cluster, Save / Timing / Publish — always reachable while the canvas scrolls):

- **Outline** (left rail): numbered section rows with per-type tone accents (opaque ramp tokens, never alpha tints). Row tools (reorder / visibility / duplicate) reveal on hover or focus; selection, errors and hidden state are always visible.
- **Canvas** (centre): draft layers as cards on a neutral workbench, each with a header strip (position, type, status, stacking tools) and an edge-to-edge body rendered with the exact storefront components. Desktop width or a framed mobile column; a Live page tab shows the published storefront.
- **Inspector** (right rail): header band (icon, type, position, title), inline validation alert, then settings grouped into labelled clusters (tiles, categories, announcements, cards) plus visibility scheduling.
- Section library (10 types, including shop rail) behind one **Add section** dialog. Names, hints, accents, defaults and presets live in a single `SECTION_REGISTRY` — adding a type without finishing it is a compile error. Each type offers named starting points (mosaic vs. wide banner strips, featured vs. most-ordered shelf) that land configured rather than blank.
- **Ratio-accurate image fields** (`StudioImageField`): every image input uploads to R2 via `POST /admin/uploads` (same pipeline as vendor product photos, keys under `merch/`), previews the real crop at the placement's aspect ratio, flags unreachable or non-HTTPS art, and — on category banners — sets `focalPoint` by click or arrow keys so the subject survives the crop. A pasted HTTPS / `/media/` URL still works.
- **Inline validation** (`validateSections` in the admin studio model mirrors the API's draft rules): problems render as badges on the list row, the preview block, and the publish bar, plus an alert inside the offending section's settings. Save/publish stop at the first problem, select that section, and focus its settings instead of failing with a bare toast.
- Duplicate, move up/down, delete; section counter (n/24). Value-grid cards (min 2) and optional CTA links each have an explicit remove control; single-item groups (last promo tile, last announcement) say so and point at section delete instead of hiding the affordance silently.
- Category picker with search filter and a picked-summary line, so a 25-department list no longer dumps unchecked.
- Real category names in preview; shelf source warnings (missing category, empty manual picks).
- Hidden/scheduled badge; buyer-view note with storefront link.

## Deployment

Apply `packages/db/src/migrations/0018_content_pages.sql` before publishing through Homepage Studio.
No new migration was needed for the v2 section fields — they are JSONB-compatible additions validated by Zod at the API boundary.

Product stats (structured attributes on the PDP / quick-buy dialog) need `packages/db/src/migrations/0019_product_attributes.sql`. Seller delivery bands and featured picks stay in `sellers.metadata` JSONB and do not need a migration.
