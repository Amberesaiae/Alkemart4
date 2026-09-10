# Vendor Store Manager — implementation plan

Owner: vendor hub (`apps/backend/apps/ghana-vendor`). API: Workers (`apps/api`).
Status: planned. Phases land independently; each phase is shippable alone.

Principles (locked): preview renders the REAL shop page, never a mock;
explicit publish for all buyer-visible content (draft → publish, dirty
tracking); no dead controls (unwired = unrendered, per the
`/unavailable` pattern); taxonomy belongs to admin, curation to vendor.

## P1 — Storefront tab (branding + announcement + live preview)

### Data (no migration — `sellers.metadata` jsonb)
- `storefront: { tagline?: string (0–120), announcement?: { text (1–140), startsAt: ISO, endsAt: ISO } | null, seoDescription?: string (0–160) }`
- Announcement active iff `startsAt <= now < endsAt`. One field (not a list) — v1 supports a single banner.
- Server validation mirrors client: lengths, `endsAt > startsAt`, URL-free text (no `http(s)://`, no `www.`), profanity-flag word list shared with bio (`profanity.ts` in `@alkemart/shared/ghana`, seed: sexual slurs, scam lures ["send money", "mpesa pin", "whatsapp me" patterns], counterfeit signals).

### Endpoints (`apps/api/src/routes/vendor/sellers.ts`)
- `PATCH /vendor/sellers/me/storefront` — body `{ tagline?, bio?, announcement?, seoDescription? }`, all optional, at least one present. Merges into `sellers.metadata.storefront`. Returns `sellerView` (same shape as `GET /me`).
- Reuse `requireSeller`, sellerId ownership (me-scoped, no id param).
- `GET /vendor/sellers/me` gains `storefront` block in response (read from metadata, defaults applied).

### UI (`apps/backend/apps/ghana-vendor/src/routes/store.tsx`, new; nav item Store)
- Layout ≥1280px: editor column (cards: Branding, Announcement, SEO) + sticky preview column (`/shops/:handle` iframe, device toggle desktop/mobile, "open live shop" link, last-published timestamp). <1280px: stacked with jump links.
- Preview iframe: `title="Live preview of your shop"`, skip link, toggle buttons `aria-pressed`, transitions under `prefers-reduced-motion`.
- Publish bar: dirty tracking per card (saved / unsaved / publishing); navigate-away confirm; error summary box (GOV.UK pattern: anchor-focus to fields) + inline `aria-describedby` errors; success `role="status"` + focus on error.
- Alt text required on logo/cover before upload completes (reuse ImageUploader with `requireAlt` prop).
- SERP snippet preview for SEO (title + handle URL + description, character counters).

### Tests & verification
- Route tests (`sellers.test.ts` style, InMemory): merge semantics, date validation, URL rejection, profanity flag, 401/404.
- `tsc` vendor + api. MCP click-through: edit → preview reflects → publish → storefront shows; screenshots. Contrast recompute on new colours (none expected — tokens only).

## P2 — Pause mode + versioned policies

### Data (migration `0008`)
- `sellers.availability ('open'|'paused')`, `paused_until timestamptz null`, `pause_note text null`.
- `shop_policy_versions (id, seller_id FK, version int, body jsonb {shipping, returns_days, warranty}, effective_from timestamptz)` append-only.
- `POST /vendor/sellers/me/pause {note?, until?}` / `/unpause`; sets fields, returns sellerView.
- Checkout guard: order creation for a paused seller's offers → 409 (server-enforced, never button-only). Test asserts the 409.
- Storefront: paused shops show vendor note + return date, ATC disabled with reason.

### UI
- Availability card in Store tab (status pill, pause form, scheduled unpause display).
- Policies card: shipping note, returns days (0 = final sale), warranty; each save appends a policy version, shows "in force since {date}".

## P3 — Catalog display + contact/SEO + insights

- `sellers.metadata.display: { categoryOrder: string[], featuredCategoryId: string|null, stockMode: 'exact'|'bands' }`.
- `shop_featured (seller_id, product_id, rank ≤ 8)` + endpoints to set/reorder.
- Contact/hours/social into metadata (typed validators: E.164 phone, day-range hours, domain-allowlisted social URLs).
- Insights: `GET /vendor/stats/shop` (views need a `shop_views` table — day-grain counters written by the storefront shop route, seller-scoped aggregate endpoint reusing the admin-stats bucket pattern).
- Reviews tab: reserved skeleton with honest "coming" copy (no dead controls).

## Out of scope (separate projects)
Buyer-written reviews + vendor responses + review moderation loop. Multi-shop per account. Draft scheduler beyond announcements.
