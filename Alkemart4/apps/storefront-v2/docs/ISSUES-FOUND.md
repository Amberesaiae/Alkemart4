# Issues found while rebuilding the storefront

Found in the old storefront (`apps/storefront`) while porting its behaviour.
Status is for **storefront-v2**; the old app is unchanged.

| # | Issue | Where | Status in v2 |
|---|---|---|---|
| 1 | Cart lines had no product id — no link back, no image | API `GET /store/cart/:id` | **Fixed** — API now returns `productId` per item (additive field) |
| 2 | Saved-address UI on account/checkout, but Workers has no address book | account, checkout | **Resolved in UI** — no fake address book; opt-in "remember on this device" at checkout |
| 3 | Wishlist heart threw "not available on Workers" | product cards, PDP | **Resolved in UI** — device-local "Saved" list, labelled as such |
| 4 | Search history only worked via Medusa | search | **Resolved** — device-local recent searches |
| 5 | Register asked for names that were discarded; profile edit didn't persist | login, account | **Resolved in UI** — only fields the API stores |
| 6 | Category filters fell back to invented sellers ("QA Test Shop"…) | category page | **Fixed** — sellers come from results only |
| 7 | Stores page guessed each shop's category from keywords in its name | stores page | **Fixed** — no guessed categories |
| 8 | Returns form posted to `/store/returns`, which doesn't exist | `/order/$id/return` | **Resolved** — route redirects to the order; help panel routes returns to support |
| 9 | Per-seller order status flattened into one status | order page | **Fixed** — each seller's part has its own timeline |
| 10 | Missing payment status displayed as "captured" (paid) | order mapping | **Fixed** — unknown stays unknown |
| 11 | Search outage showed "No results" | search | **Fixed** — error state with retry (verified live) |
| 12 | Location facet showed as applied but filtered nothing | category page | **Fixed** — removed until the API supports it |
| 13 | Rating filter was a no-op (read `rating`, cards carry `ratingAvg`; unrated treated as 5★) | category/search | **Fixed** — filters on `ratingAvg`; unrated excluded when a minimum is set (**reverses a deliberate earlier choice** — see note) |
| 14 | Similar items labelled "Sponsored products" | PDP | **Fixed** — "Similar items" |
| 15 | Newest catalogue labelled "Customers who viewed this also viewed" | PDP | **Fixed** — removed |
| 16 | Shop directory hid outages as "no shops"; any shop error read "Store not found" | stores, shop page | **Fixed** — only 404 is "not found" |
| 17 | Admin Markets page calls `/admin/alkemart/markets` (Medusa leftover, not served) | admin app | **Not fixed (out of scope)** — flagged |
| 18 | Manifest referenced PWA icons that never existed | public | **Handed to Codex** (asset brief §1) |
| 19 | Card quick-add bound the best offer — silently picked seller/variant | product cards | **Fixed** — quick-buy sheet uses the PDP's selection rules |
| 20 | Manual homepage shelves lost products older than the newest 36 | home | **Fixed** — picks fetched by id |
| 21 | Campaign mobile creative never used | home | **Fixed** — chosen by viewport |
| 22 | Hard-coded fake subcategories when a department had none | category page | **Fixed** — API children only |
| 23 | Real "Phones" subcategory hidden by a special case | category page | **Fixed** |
| 24 | Price/seller/rating filters ran on the first ~48 items with the server total shown | category page | **Fixed** — price/attributes filter server-side; seller/rating count is labelled |
| 25 | Search facets read keys the API never returns; attribute filters never offered | search | **Fixed** — attribute + condition facets |
| 26 | MoMo pending page polled forever | checkout pending | **Fixed** — stops after 10 min with next steps |
| 27 | **Card payments never confirmed on return** (ref read in effect → query never enabled) | card callback | **Fixed** |
| 28 | Buyers had no way to write the verified-purchase reviews the API supports | order page | **Fixed** — "Review this order" on delivered orders |
| 29 | Shop locations stored as region codes ("GH02") shown raw; "Deliver to" area matching never matched them | shops, near-me | **Fixed** — normalised through the market config |

## Decisions for you

- **#13 rating filter**: the old test said unrated items count as 5★ "so new
  listings are not buried". v2 excludes them once a buyer picks "4★ & up",
  because the buyer asked for rated items. Easy to revert in
  `src/lib/listing/ListingFacets.ts` if you prefer the old intent.
- **Privacy policy** (copied verbatim): it mentions "saved addresses", which
  Workers doesn't have, and doesn't mention the device-local recent searches
  or the optional saved delivery details. Legal wording is yours to change.
- **Address book / wishlist / returns** are "Not in SoR yet"
  (LIFECYCLE-BUYER). If you scope them, the v2 UI has obvious homes for them
  (account page, Saved page, order help panel).
- **Markets API**: v2 reads market config from one module (`src/lib/market.ts`).
  Admin-controlled markets need `GET /store/markets` (+ admin CRUD) over the
  existing `markets` table, extended with locale fields; then only that module
  changes.
