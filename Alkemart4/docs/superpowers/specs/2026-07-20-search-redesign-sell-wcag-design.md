# Search page redesign + Sell page WCAG fixes

| Field | Value |
|-------|-------|
| **Date** | 2026-07-20 |
| **Status** | Draft |
| **Scope** | Storefront (no backend changes needed beyond 3 new endpoints) |

## 1. Search page — standalone, Google-style landing

### Layout
- Route `/search` renders a **standalone shell** — no `AppHeader`, no category rail, no `AppFooter`
- The root layout (`__root.tsx` `Shell`) detects `/search` and renders a minimal wrapper: skip link + `<main>` + `<Outlet>` — nothing else
- Full viewport gold background (`bg-[#febf31]`), min-height `100vh`
- Text/links on gold: dark ink (`text-[#1a1a1a]`)

### SearchMicroHeader
- Wordmark "alkemart." left (same font-weight/look as `BrandLogo`)
- "Back to shop" link right (`→` arrow)
- Fixed/sticky top
- Dark text on gold

### SearchHero (idle state, no `q` param)
- Vertically centered in the viewport (or near-center with padding)
- Large pill search bar, white background, `h-14` min-height, `text-base`, `rounded-full`, dark border
- Search icon inside left, autoFocus
- Below bar:
  - **Recent searches** — row of pill chips with X to dismiss, labeled "Recent"
  - **Popular now** — chips from API (frequent) + static `popular-searches.ts` fallback
  - **Browse departments** — smaller link grid matching existing pattern

### Results state (`q` param present)
- Search bar remains at top (scrolls with page)
- Results render on white card sections over gold background
- Product cards: use existing `ProductCard` component
- Empty state: "No results for X" with gold-themed illustration

### Search history micro-feature
- `useSearchHistory()` hook:
  - Generates `alk_device_id` UUID on first visit, stored in localStorage
  - `track(q)` → `POST /store/search/track` with `X-Device-Id` header
  - `recent: string[]`, `frequent: string[]` → `GET /store/search/history`
  - `removeOne(q)` → `DELETE /store/search/history` with body `{ query }`
  - `clear()` → `DELETE /store/search/history` (no body)
  - React Query: stale 30s, cache 5min
- History fetched on focus/search bar mount, displayed as chips below bar
- On search submit: track the query, navigate to `/search?q=...`

### Backend API endpoints (3 new store routes)

**`GET /store/search/history`**
- Query params: none (uses `X-Device-Id` header, and session cookie for customer_id)
- Response:
```json
{
  "recent": ["rice", "phones"],
  "frequent": ["cooking oil", "water"]
}
```
- Recent: last 10 distinct queries for this device/customer, ordered by recency
- Frequent: top 10 queries across all users, ordered by count
- Customer history merged with device history when authenticated

**`POST /store/search/track`**
- Body: `{ "query": "rice" }`
- Records to `search_history` table with device_id + optional customer_id
- Deduplicates: if same query exists within last 24h, bump `created_at` instead of duplicating
- Returns 200

**`DELETE /store/search/history`**
- Optional body `{ "query": "rice" }` to remove a single query
- No body = clear all history for device/customer
- Returns 200

### Data model
Simple table added to existing database (no new module — just raw SQL/knex or Prisma through existing Medusa connection):
```
search_history
  id          uuid PK
  device_id   varchar(64) NOT NULL
  customer_id varchar(64) NULLABLE
  query       varchar(255) NOT NULL
  created_at  timestamptz NOT NULL DEFAULT now()
```
Index on `(device_id, created_at DESC)` and `(customer_id, created_at DESC)`.

### Files to create/modify

| File | Action |
|------|--------|
| `src/routes/search.tsx` | Rewrite — standalone search page |
| `src/lib/search-history.ts` | New — hook + API calls |
| `src/routes/__root.tsx` | Add `/search` to standalone layout condition |
| `packages/api/src/api/store/search/history/route.ts` | New — GET + DELETE handler |
| `packages/api/src/api/store/search/track/route.ts` | New — POST handler |

## 2. Sell page WCAG fixes

### Fixes applied to `src/routes/sell.tsx`

1. **First illustration visibility** — header `sm:grid-cols-[1fr_auto]` collapses to stacked on mobile. The `authSeller` illustration sits in the second column (`auto`). Ensure it always renders with top margin when wrapped below text.

2. **CTA buttons always same row** — "Open a seller account" and "Seller Hub login" use `flex flex-nowrap` (not `flex-wrap`) with `gap-2`, and buttons use `whitespace-nowrap` to prevent wrapping. On very small screens, buttons shrink-text or use `text-xs` before wrapping.

3. **Step cards mobile WCAG:**
   - `gap-8` between cards (was `gap-4`)
   - Card padding increased to `p-6` on mobile
   - Step number box `h-10 w-10` (was `h-8 w-8`) for touch target
   - Buttons/links use `min-h-11` for 44px target
   - Each step card has `aria-label="Step X: ..."` on the wrapper
   - Cards use `focus-visible:ring-2 focus-visible:ring-ring`
   - Page container `overflow-x-hidden` to prevent any horizontal scroll

4. **Text & contrast:**
   - All body text on sell page already uses `text-muted-foreground` which was darkened to `#3d3d3d` — meets WCAG AA
   - Section labels ("For merchants") bumped to `text-sm` (was `text-xs`) on mobile
   - Already confirmed no `text-[10px]` or `text-[11px]` in the component

### Files to modify

| File | Action |
|------|--------|
| `src/routes/sell.tsx` | Mobile WCAG fixes, button row, illustration margin |

## 3. Open items

- Search history migration for existing anonymous users: not needed — device ID generated on first visit post-deploy
- Rate limiting on track endpoint: consider if needed later; not in initial scope
- Search results on gold background: existing `ProductCard` on white cards on gold — verify contrast between card border and gold
