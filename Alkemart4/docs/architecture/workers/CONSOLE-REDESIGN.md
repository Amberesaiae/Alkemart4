# Vendor & Admin redesign — plan

Status: **phase 1 built** (kit, both shells, sign-in, vendor Home, admin Overview); phases 2–6 to go. New apps: `apps/vendor-v2` (port 3004),
`apps/admin-v2` (port 3003), shared kit `packages/console-ui`
(shadcn `create --monorepo`, radix-maia, Figtree, Hugeicons). The old apps
stay untouched until the swap, like storefront-v2.

Written from a full read of `apps/backend/apps/ghana-vendor`,
`apps/backend/apps/admin`, the Workers API routes, `LIFECYCLE-VENDOR.md`,
`LIFECYCLE-ADMIN.md` and `NAV-MATRIX.md`.

---

## 1. Who we design for

**The seller (vendor app).** A Ghanaian shop owner or market trader running the
business from an Android phone, often on mobile data, between customers. They
think in jobs, not features: *"Did anything sell? What do I pack? When do I get
my money? How do I put this new stock up?"* They know MoMo, cedis and their
region, not "offers", "variants" or "SEO".

**The operator (admin app).** An alkemart staff member on a laptop working
through queues: approve sellers, review listings, watch orders, pay sellers,
merchandise the storefront. They need speed, keyboard access, and certainty
that an action did what it says.

Design rules for both:

- **Jobs first.** Navigation names the job ("Orders to pack"), not the data
  model ("Fulfilment workflow").
- **Plain words.** No platform jargon in seller-facing text: *offer → price &
  stock*, *propose → send for review*, *collection → shelf*, *SEO → how you
  show up in search*.
- **Honest states.** An outage is an error with Retry, never zeros or "no
  orders". A feature the API doesn't have is absent, not a stub.
- **Accessible by default.** WCAG 2.2 AA; 44px touch targets; visible focus;
  every status has text, not only colour; forms announce errors.
- **Market-agnostic.** Money, phone, regions and payout methods come from the
  market config (as in storefront-v2); Ghana is data, not code.

---

## 2. Problems found in the current apps

### Vendor

| # | Problem | Where | Effect |
|---|---|---|---|
| V1 | 8 items in the phone tab bar at 10px text, **Sign out in the tab bar** | `components/layout.tsx` | Unreadable; accidental sign-outs next to Orders |
| V2 | "Store" vs "Settings" overlap — logo/cover live in Settings, branding in Store | `store.tsx`, `settings.tsx` | Sellers can't guess where to change their shop |
| V3 | Two ways to add a product (Quick Sell, full editor) with no link between them; Quick Sell isn't in the nav | `quick-sell.tsx`, `products/$id.tsx` | "Where do I add stock?" |
| V4 | Mega-screens: product editor 1,641 lines, Store 1,337, Settings 906 | routes | Endless scroll on a phone; hard to maintain |
| V5 | Dashboard stats **swallow errors and show zeros** (`emptyStats()`) | `lib/api.ts:1619` | An outage looks like "you sold nothing" |
| V6 | Any `/me` failure (including a network blip) **logs the seller out** | `routes/__root.tsx` | Lost work on flaky data |
| V7 | Session token in `sessionStorage` | `lib/api.ts` | Every new tab / reopened app asks to sign in again |
| V8 | `/returns` route is an orphan with a fake empty list and 501 stubs | `returns.tsx`, `lib/api.ts:1416` | Dead code pretending to be a feature |
| V9 | Medusa/Mercur leftovers (e.g. `mercur_status`) — 29 mentions across vendor + admin | `lib/api.ts` | Confusing types, dead branches |
| V10 | API features with no screen: bulk CSV import, traffic stats (partly), tasks | `/vendor/imports`, `/vendor/stats/shop` | Sellers can't use what exists |
| V11 | NAV-MATRIX says the phone bar is Dashboard/Products/Orders/Settings; code has 8 items | docs vs code | Doc drift |

### Admin

| # | Problem | Where | Effect |
|---|---|---|---|
| A1 | **Two homepage editors with conflicting models.** Homepage Studio uses draft → publish/schedule with revisions; Live Studio *publishes straight to live* | `homepage.tsx`, `studio.tsx` | An operator can overwrite a scheduled draft by accident |
| A2 | Live Studio depends on the old storefront's `?studio=1` edit mode, which **storefront-v2 does not have** | `studio.tsx` + `storefront/src/lib/studio-edit.ts` | Breaks the day v2 is swapped in |
| A3 | Seven Medusa pages kept behind a flag (markets, featured, promotions, returns, disputes, commission rates, legacy categories); the API client still calls endpoints Workers doesn't serve (`/admin/alkemart/*`, `/admin/promotions`, `/admin/featured-products`…) | `Sidebar.tsx`, `lib/api.ts` | Dead weight; Markets page is broken |
| A4 | "Product Review" (listing moderation) vs "Reviews" (buyer reviews) | sidebar | Two different jobs with the same word |
| A5 | Attributes page is not in the nav | `attributes.tsx` | Only reachable by URL |
| A6 | API features with no screen: seller **verifications**, payout **holds**, **guides**, **experiments**, **feed diagnostics** | `LIFECYCLE-ADMIN.md` | Built but unusable |
| A7 | Per-seller commission exists in the API, but the "Commission" page is a Medusa leftover | `commission-rates.tsx` | The real control is buried |
| A8 | Sidebar mixes storefront tools, analytics and markets under "Catalogue" | `Sidebar.tsx` | The confusion you described |
| A9 | Payout list is "soft-empty" in the UI (per lifecycle doc) | `payouts.tsx` | Can't see payout history |

---

## 3. Vendor app — new structure

Five destinations. The same five on phone (bottom bar) and desktop (sidebar).
Account lives behind the shop avatar, top right.

| Tab | Job it answers | What's inside |
|---|---|---|
| **Home** | "What needs me today?" | **To do** first: orders to pack (oldest first, with how long they've waited), listings sent back for changes, setup steps until the shop can sell, listing-health warnings (`/vendor/tasks`, `/vendor/health`). Then **today & this week**: sales, orders, shop views (`/vendor/stats/shop`), next payout. |
| **Orders** (badge = to pack) | "What do I pack and send?" | Tabs: **To pack** · **On the way** · **Delivered** · **All**. Order page is a 3-step tracker: *Pack → Send → Delivered*, one big button for the next step, buyer name/phone/area, items with photos, "Share order details" (WhatsApp-friendly text). Returns become a tab here once the API exists. |
| **Products** | "What am I selling? Add new stock." | Status chips: **Live · In review · Needs changes · Draft · Out of stock**. Quick stock +/− inline. **Add product** is one guided flow (below). Desktop extra: *Import from spreadsheet* (`/vendor/imports`, dry-run first). |
| **Money** | "When do I get paid?" | Balance cards: **On the way to you** (pending) · **On hold** (with the admin's reason) · **Paid**. Statement lines per order. Payout method (MoMo number, status) with *Change*. A short honest note on how payouts work (admin-triggered, when). |
| **Shop** | "How does my shop look to buyers?" | Sections, each its own short page: **Shop look** (logo, cover, tagline, announcement) · **Shelves** (collections + featured picks) · **Policies** (delivery, returns days, warranty) · **Contact & hours** · **Reviews** · **Performance** (views, top products, conversion) · **Pause shop** (vacation mode). "View my shop" opens the live page. |

**Account** (avatar menu; a sheet on phones): payout details shortcut ·
dispatch address · notifications (alert topics) · password · help · **Sign
out** (with confirm).

What merged / moved:

- *Store* + *Reviews* + shop identity from *Settings* → **Shop**
- *Settings* → **Account** (only personal / payout / notification settings)
- *Quick Sell* + product editor → one **Add product** flow
- *Dashboard* → **Home** (a to-do list, not a chart page)

### Add product — one flow, two depths

1. **Snap & basics** (fits one phone screen): photos (compressed on the device
   before upload), name, category (searchable, suggested from the name),
   price, quantity. → *Send for review* or *Save draft*.
2. **More details (optional, collapsible)**: options like size/colour
   (variant builder), the category's attribute fields (from the admin
   attribute profile), condition, delivery promise, warranty, returns.

The review status is always visible afterwards, and "Needs changes" shows
the admin's note with a *Fix and resend* button (and *Appeal* where the API
allows it).

### Onboarding

`Register → "We're reviewing your shop" (what happens next, typical wait) →
approved → 3-step setup (shop name & region → MoMo payout → first product)`.
Home shows the remaining steps until done; selling actions explain why
they're locked instead of just disabling.

---

## 4. Admin app — new structure

Grouped by the operator's jobs. Ten entries, down from nineteen links (seven
of which were dead).

| Group | Entry | Tabs / contents | Replaces |
|---|---|---|---|
| — | **Overview** | "Needs attention" counts that link to queues (applications, listings to review, appeals, payouts due, holds); GMV & orders (30 days); traffic; top products & shops | Dashboard, Analytics (headline part) |
| Operations | **Orders** | Filters in the URL; order detail with per-seller parts, payment status, timeline | Orders |
| | **Payouts** | Due · History · **Holds** (place/release with reason) | Payouts (+ holds, A6) |
| | **Buyer reviews** | Moderation | Reviews |
| Sellers | **Sellers** | Applications · Active · Suspended; seller page: profile, status actions, **commission** (A7), **verifications** (A6), holds, their listings & orders | Seller Queue, All Sellers, Commission |
| | **Appeals** | Seller appeals on rejected listings | Appeals |
| Catalogue | **Listings** | Needs review · Changes requested · Rejected · Live; review drawer with variant matrix | Product Review (renamed, A4) |
| | **Categories** | Tree · **Attributes** · Proposals | Categories, Taxonomy board, Attributes (A5) |
| Storefront | **Homepage** | One editor: outline + inspector, **Preview** mode showing the real storefront-v2 page; draft → publish / schedule only | Homepage Studio **and** Live Studio (A1, A2) |
| | **Campaigns** | Placements, creatives, schedule, report | Campaigns |
| | **Guides** | Buying guides: draft, sections, publish | *(new — API exists)* |
| Insights | **Analytics** | Traffic, GMV, feed health (diagnostics), **experiments** | Analytics (+ A6) |

Plus a **command palette** (Ctrl/⌘ K): jump to any order, seller or product by
name or id; run common actions.

Removed until the API exists: markets, featured products, promotions,
returns, disputes, global commission rates. (Markets comes back under
Settings once `GET /store/markets` + admin CRUD exist — see storefront-v2
`ISSUES-FOUND.md`.)

---

## 5. How the three apps connect

```
Seller registers ──► Admin › Sellers › Applications ──approve──► Seller setup unlocked
Seller adds product ─send for review─► Admin › Listings ──approve──► Storefront catalogue
                                              └─request changes─► Seller › Products "Needs changes" ─fix/appeal─► Admin › Appeals
Buyer orders (storefront) ──► Seller › Orders "To pack" ─pack/send/deliver─► buyer SMS + storefront order timeline
                                                                   └─delivered─► payout-eligible
Admin › Payouts (pay / hold) ──► Seller › Money (paid / on hold + reason)
Seller › Shop (look, shelves, policies, pause) ──► Storefront /shops/:handle, PDP pause state
Admin › Categories (tree, attribute profiles) ──► Seller add-product fields + storefront filters
Admin › Homepage / Campaigns / Guides ──► Storefront home sections, placements, /guides
Buyer reviews ──► Seller › Shop › Reviews and Admin › Buyer reviews
```

One shared **status vocabulary** lives in `packages/console-ui` (and matches
storefront-v2), so an order, listing or payout shows the same word and
colour everywhere:

| Domain status | Seller sees | Admin sees | Buyer sees |
|---|---|---|---|
| order `placed` | To pack | Placed | Order placed |
| order `shipped` | On the way | Shipped | On the way |
| order `delivered` | Delivered | Delivered | Delivered |
| product `draft` | Draft | Draft | — |
| product `proposed` | In review | Needs review | — |
| product changes requested | Needs changes | Changes requested | — |
| product `published` | Live | Live | (visible) |
| payout line pending / held / paid | On the way to you / On hold / Paid | Due / Held / Paid | — |

---

## 6. Practices we'll follow

- **Errors:** every query shows loading → content → empty → error-with-retry;
  never fall back to fake data. 401 goes to sign-in; network errors don't.
- **Session:** vendor stays signed in across tabs and app restarts (move the
  token out of per-tab `sessionStorage`; confirm the approach against the
  API's cookie support first).
- **Money:** never optimistic. Payout and hold actions wait for the server,
  confirm in a dialog that names the amount and the seller, and show the
  audit entry afterwards.
- **Destructive actions:** alert dialog naming the thing ("Suspend Kofi's
  Gadgets?"), with the consequence spelled out.
- **Tables (admin):** filters, sort and page live in the URL (shareable,
  back-button safe); row click opens a detail page or drawer; bulk actions
  only where the API supports them.
- **Phone-first (vendor):** single column, sticky primary action at the
  bottom, images compressed before upload, skeletons instead of spinners,
  forms that survive a dropped connection (draft kept on device).
- **Accessibility:** WCAG 2.2 AA; focus ring (ink + halo, as storefront-v2);
  44px targets; labels on every input; charts carry a text summary and a
  table fallback.
- **Language:** plain English now, all strings in one place per app so Twi,
  French or Hausa can be added per market later.
- **Docs:** update `NAV-MATRIX.md`, `LIFECYCLE-VENDOR.md`,
  `LIFECYCLE-ADMIN.md` as each screen lands (AGENTS.md rule 5).

---

## 7. Build order

| Phase | Scope |
|---|---|
| 1 | Kit (`console-ui`: app shell, sidebar + phone tab bar, stat card, chart card, data table, status badge, empty/error states), both apps' sign-in, vendor **Home**, admin **Overview** |
| 2 | Vendor **Orders** and **Products** (incl. the Add product flow) |
| 3 | Vendor **Money**, **Shop**, **Account**, onboarding |
| 4 | Admin **Sellers**, **Listings**, **Orders**, **Payouts** (+ holds, verifications, commission) |
| 5 | Admin **Categories**, **Homepage** (with v2 preview), **Campaigns**, **Guides**, **Analytics** |
| 6 | Accessibility audit, click-through against NAV-MATRIX, docs, swap plan |

## 7a. Found while building phase 1

| # | Finding | Plan |
|---|---|---|
| B1 | `GET /vendor/orders` returns no date, item summary or buyer area — only id, amounts, status. "Oldest first, waiting N hours" can't be shown. | Phase 2: additive fields on the list (`placedAt` from the order group, `itemCount`, first item title/image, buyer city/region). |
| B2 | `/vendor/tasks` and `/vendor/health` return `href`s to the **old** vendor routes (`/settings?tab=profile`). | vendor-v2 routes tasks by `kind` (`src/lib/nav.ts`); update the API hrefs at the swap. |
| B3 | `/admin/stats` returns `total_gmv_ghs` / GHS majors — a currency in a field name. | Display is market-agnostic already (`formatMajor`); rename to minor units + currency when the stats endpoint is next touched. |
| B4 | Codex's logo PNGs are 290–380 KB each. | Consoles ship 8 KB WebP copies; storefront-v2 should get optimised files (asset brief). |
| B5 | Dev CORS list lacked the new ports. | Added 3003/3004 to `apps/api/src/middleware/cors.ts`. |

## 8. Decisions (confirmed 2026-09-25)

1. **Homepage**: one editor with a Preview mode of the real storefront-v2
   page; every change goes draft → publish/schedule. Live Studio is retired.
2. **Returns & disputes**: hidden until the API exists.
3. **Vendor sign-in**: stays signed in across tabs and restarts (verify the
   API's cookie/refresh support first; no token in `localStorage` if a
   cookie session is available).
4. **Guides and experiments**: built in phase 5.
5. **Languages**: English for launch, strings kept in one place per app.
