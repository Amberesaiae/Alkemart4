# Build log — autonomous session (from 2026-09-25 evening)

What was built while you were away, how each piece was proven, and what is
waiting for you. Newest section last. Nothing was committed or pushed, and
**no migration was applied to Supabase** — apply them yourself (list below).

Verification standard: every feature is walked end to end in the in-memory
sandbox (`bun apps/api/scripts/sandbox.ts` + preview configs `sandbox-*`),
not just unit-tested.

## Waiting for you

### Migrations to apply (in order, all idempotent)
| File | What |
|---|---|
| `0036_order_timeline.sql` | `order_events` (dated status history) + frozen delivery promise columns on `orders`; backfills a `placed` event for existing orders |
| `0037_buyer_accounts.sql` | buyer profile columns, `buyer_addresses`, `password_reset_tokens` |
| `0038_listing_reviews.sql` | `listing_reviews` (every submit / rule / AI / admin decision with reasons) + `platform_settings` |
| `0039_payout_trust.sql` | payouts `reversed` status + failure reason / paid_at / created_by; `payout_events` (payout timeline); `paystack_events` (webhook log + alerts) |
| `0040_newsletter.sql` | `newsletter_subscribers` (double opt-in: pending → confirmed / unsubscribed) |
| `0047_videos_and_assist.sql` | `product_videos` (platform + id, pending/approved/rejected, featured), `listing_assist_usage` (photo reads per seller per month). **Phase 6 paused — routes not mounted** |
| `0046_deals.sql` | `offer_negotiation` (negotiable, hidden floor per listing), `price_offers` (buyer offers: pending/countered/accepted/used…), `payment_intents.deals` (deal prices frozen at checkout) |
| `0045_messaging.sql` | `message_threads` (buyer + seller + subject, read marks, block, report), `messages` (with contact flags), `product_questions` |
| `0044_returns.sql` | `return_cases` (one open per order: reason, wish, status, `respond_by`, offer, decline reason, outcome, refund amount/route/status/ref, seller recovery + `recovered_payout_id`, admin note, timeline); orders `refunded_pesewas`; payouts `recovered_pesewas`. Legacy unused `returns` (0004) left alone |
| `0043_statements.sql` | frozen monthly statements (scope, seller, period, data, SHA-256 hash); unique per month; never updated |
| `0042_fulfillment.sql` | intent `fulfillment` (per-seller choice + fee); orders `fulfillment_method`, `delivery_zone`, `handover_code`, `handover_failures`, `delivery_confirmed_by`, `payout_release_at` |
| `0041_address_pins.sql` | `buyer_addresses.latitude/longitude` (pinned delivery spot; both or neither) |

### Decisions / questions
1. **Delivery fee on online orders** — payouts pay `subtotal − commission`; the
   buyer's delivery fee is never passed to the seller who delivers. Intended?
2. **Recovering COD commission** — shown to sellers as "Commission you owe";
   no settlement record yet (net off next online payout vs collect separately).
3. **Ghana-only DB constraint** — migration 0035 adds `sellers_coords_in_ghana`
   (lat/lng box). It will reject every seller outside Ghana; needs a
   per-market bound or removal before a second market.
4. **Rotate the live Paystack secret key** you pasted in chat.

## 1. Money safety — COD never paid out (done, verified)
See LIFECYCLE-PAYMENT "Settlement". Sandbox: COD order delivered → seller Home
shows GH₵0.00 on the way, "Commission you owe GH₵1.05 on GH₵20.00 cash".

## 2. One order reference everywhere (done, verified)
`@alkemart/shared/order-ref` → buyer page, seller screens, SMS, admin.

## 3. Order clock: timeline, promises, lateness (API done)
- `@alkemart/domain` `order-promise.ts`: seller promises same-day minutes OR a
  day range + dispatch hours; frozen per order at checkout
  (`freezePromise`); `promiseStatus` → on_track / dispatch_late /
  delivery_late / done. 5 tests.
- Every status change writes an `order_events` row in the same transaction;
  the update is conditional on the status read (no double-apply race);
  repeating the same step is a no-op 200, a real conflict is 409.
- Buyer, seller and admin order responses carry `promise`, `timeline`
  (`{status, at, by}`) and `paymentState` (COD reads
  "collect_on_delivery" until delivered — never "paid" early).
- `PATCH /vendor/sellers/me/delivery` accepts `days {min,max}` and
  `dispatchHours` (2/6/12/24/48/72) alongside the old minute bands.

## 4. Buyer accounts + email (API done, 264 API tests green)
- Migration `0037_buyer_accounts.sql`: users.first_name/last_name/phone/
  password_changed_at; `buyer_addresses` (one default per buyer, partial
  unique index); `password_reset_tokens` (SHA-256 hashed, single use, 1h).
- `/store/account` (buyer only): GET/PATCH profile; POST `/password`
  (needs current password, emails "password changed", returns a fresh
  session — older sessions get 401 on account routes); address book CRUD +
  `/addresses/:id/default`; max 20 addresses; owner-scoped (404 otherwise).
- Password reset for buyers (`/store/auth/password-reset/{request,confirm}`)
  and sellers (`/vendor/auth/…`): identical 202 for unknown emails (no
  enumeration), ≤3 emails / address / 15 min + IP limiter, link origin from
  `STOREFRONT_URL` / `VENDOR_URL` config only (never request headers).
- Email: `email.ts` (Resend provider, log stub, test double); outbox rows
  with `channel: "email"`; dispatcher routes by channel. Templates: reset,
  password changed, order placed (buyer), new order (seller), sent,
  delivered. Deterministic keys → no duplicates on webhook retries.
- **To go live:** set `RESEND_API_KEY`, `EMAIL_FROM` (verified domain),
  optional `EMAIL_REPLY_TO`, and `STOREFRONT_URL`, `VENDOR_URL` as Worker
  vars. Without the URLs, production skips order emails and reset answers
  503 (by design — no guessing links).

### Buyer account UI (storefront-v2, verified in sandbox at phone width)
- `/account` hub (greeting, Orders/Addresses/Profile & security/Saved
  tiles, latest orders, notifications, alerts), `/account/addresses`
  (cards, bottom-sheet editor, default, remove-with-confirm),
  `/account/settings` (profile, change password), `/forgot-password`,
  `/reset-password`, "Forgot password?" on sign-in.
- Checkout: signed-in buyers get their address book as tappable cards
  (default preselected, full form collapses); a new address can be saved
  back. Guests keep "remember on this device".
- Walked: add address → checkout picks it → order delivers to it →
  "order placed" + seller "new order" emails in the outbox → forgot
  password → emailed link → new password → same link refused → old tab's
  session ends with a clean redirect to sign-in.
- Any 401 on a signed-in call now signs the buyer out cleanly (no silent
  half-broken pages); `requireFreshSession` guards account, orders,
  preferences and alerts.
- Fixed: price alerts and order totals divided by a hard-coded 100 — now
  the market's minor units.
- Correction: the earlier "checkout fields have no labels" finding was a
  tool artefact (it names inputs by placeholder); every field is labelled.
- **Auth note:** WorkOS will replace sign-in/sessions later. The reset,
  password-change and session-freshness pieces are a working bridge; keep
  the address book and profile (they're commerce data, not auth).

## 5. Seller products (vendor-v2, verified in sandbox at phone width)
- **Products list**: shelves (Needs changes / Drafts / In review / Live /
  Low / Out of stock) with counts, search, photo + price range + stock +
  options per card, thumb-reach "Add product".
- **Add product** — 4 steps with progress, autosaved on the device:
  photos (compressed on the phone to ≤1600px before upload, real upload
  progress, cover + reorder, retry on failure) → basics (live listing
  hints, category picker with "Looks like: Phones…" suggestions from the
  name, condition, description) → price & stock (simple, or options:
  2 option types with one-tap suggestions, value chips, a combination
  grid with per-combo price/stock, apply-to-all, switch off combos you
  don't carry; category spec fields with required marked) → review
  (buyer-style preview, checklist, Save draft / Send for review).
- **Draft-first creation (API, additive `draft: true`)**: create draft →
  photos → specs → condition → send for review (which enforces required
  specs). A dropped connection leaves a resumable draft, never a
  half-built listing in the review queue. Old seller app unchanged.
- **Edit page**: status banner with the one next action, photos, details,
  per-option price/stock with ± and switches, specs with "Suggest from my
  title" (Workers AI), hide / delete (delete refused when orders exist).
- **Shared listing rules** `@alkemart/domain` `checkListing`: contact
  details (phone/links/emails/handles) block, no photo/price/category or
  missing required specs block; short/long/ALL-CAPS/noisy titles and
  20× price spreads flagged; tips for 1 photo / short description.
  Sellers see them live; the review system runs the same rules.
- Bugs found by the cycle and fixed: `GET /vendor/products` returns one row
  per variant (the app now groups by product); the in-memory catalogue
  returned no photos/options/variants in those rows (now same as
  Postgres); combination rows were unreadable at phone width; the review
  action bar overflowed.

## 6. Listing review: rules + AI + humans (API + seller UI verified)
- Every step recorded in `listing_reviews`: seller submitted → system rules
  → AI opinion → admin decision, each with structured reasons in the
  seller's words; admins see model + confidence, sellers never do.
- Review mode (admin switch, audited): **manual** (humans only),
  **assist** (default — AI advises, human decides), **auto** (AI may
  approve only rule-clean, unflagged listings at ≥ 0.85 confidence, and
  may send back clear quality fixes). Contact details / missing photo /
  missing specs go straight back to the seller in every mode; scam or
  counterfeit phrases always reach a human. AI output is untrusted and
  validated; timeouts/errors = no opinion, never a decision.
- Admin decisions accept reasons + note (old admin app still works: body
  optional). `GET/PUT /admin/products/review-settings`,
  `GET /admin/products/:id/reviews`; seller `GET /vendor/products` carries
  the latest review, `/vendor/products/:id/reviews` the history.
- Seller UI: "Needs changes" shelf, numbered reasons, the team's note,
  "I've fixed it — send again", "Ask for a second look" (appeal).
- Walked: create listing → submitted → escalated (no AI in sandbox) →
  admin rejects with 2 reasons + note → seller sees them → appeal lands in
  the admin appeals queue. 5 API tests cover every mode with a fake AI.
- **To turn on AI review in production:** the `[ai]` binding already
  exists; choose "AI assists" or "AI decides" in admin → Listings.

## 7. Admin → Listings (verified in sandbox admin + vendor)
- One screen: review-mode switch (Manual / AI assists / AI decides — the
  last asks for confirmation), queues Needs review · Sent back · Rejected ·
  Live (oldest first while waiting), rows with shop, wait time, flags and
  the AI's verdict + confidence.
- Detail sheet: photos, description, every option with price and stock,
  the same rule findings sellers see, flags, AI opinion, full history, and
  a decision with one-tap reason presets written for sellers (+ a note).
- Walked: seller submits earbuds filed under Phones → admin sends back with
  "wrong category" + "photos" + note → seller's phone shows both reasons
  and the note with "I've fixed it — send again".
- Fixed while walking: sidebar "listings to review" badge counted listings
  waiting on the seller (now one shared rule, `awaitsReview`); kit toggles
  showed "selected" and "hovered" identically (selected is now solid ink —
  also fixes the vendor product wizard).

## 8. Vendor → Shop, social links, delivery promise (verified in sandbox)
- One Shop screen, each card saves on its own: **Shop glow-up** checklist
  (logo, cover, tagline, socials, delivery, returns → links to the card),
  open / take a break (date + buyer message), share link (copy /
  WhatsApp), look (logo, cover, name, tagline, bio), **socials**,
  **delivery** (earliest/latest day steppers, hand-over time, fee incl.
  free), contact & hours, returns & warranty (versioned), and **On Google &
  when shared** — an automatic preview that replaces the old SEO page
  (optional own description, 160 chars).
- Social links (domain `normalizeSocial`): sellers type `@handle`, a
  pasted link, or a local number; we store one https URL on the platform's
  own host (tiktok/instagram/facebook/wa.me). Look-alike hosts and bare
  homepages are refused with a fix-it message; empty removes a link (it
  previously could never be removed).
- Storefront shop page: TikTok/Instagram/Facebook chips with the handle
  next to the shop name; WhatsApp "Chat" uses the stored link (it used to
  rebuild it from digits); header shows "Delivers in 1–5 days" — the shop
  header had never shown delivery at all (field wasn't mapped).
- Walked: seller sets @accra.mart / accramart / 024 412 3456 (evil host
  refused) → buyer shop page shows the chips + Chat → seller changes the
  promise to 1–5 days, same-day hand-over → next COD order is frozen with
  dispatch +12h and delivery +1…+5 days.
- Fixed while walking: in-memory checkout read the promise from a separate
  catalogue copy (sandbox now reads the seller record, as Postgres does);
  free delivery (0) was rejected by the money parser; "1 orders".

## 9. Paystack money safety + Money / Payouts screens (verified in sandbox)
Audited against Paystack's docs — see `PAYSTACK-TRUST.md` (practices + 22
use cases, who sees what). Bugs fixed:
- **Expiry could strand a paying buyer:** intents were expired by clock
  alone; Paystack only webhooks successes and retries for 72h. Expiry now
  verifies by reference first (success → order, in flight → wait,
  otherwise expire). A success that still lands after close is acknowledged
  and raised as an admin alert with a Refund action.
- **Held orders were paid out:** holds only showed on the statement; the
  payout query ignored them. Now excluded; an account hold blocks payouts.
- **Ledger could record orders that weren't paid:** the ledger recomputed
  "unpaid orders" after the transfer. Payouts now reserve the exact orders +
  reference first, then send that amount.
- **Retries could pay twice:** each attempt minted a new reference. One
  reference per payout, reused on retry.
- **"Paid" before Paystack confirmed; failures never released orders:**
  transfer webhooks were ignored. Now reserve → send → settle, with
  webhook / Check status; failed or reversed transfers free the orders.
- Currency is verified alongside amount.
Screens: vendor **Money** (next payout / on its way / paid / held, cash +
commission owed, payout number with network auto-detect, every payout with
its Paystack timeline + reference, statement with filters + CSV, how money
works) and admin **Payouts** (ready to pay with blockers in words, confirm
dialog with destination, holds with order pick-list, history with timeline,
Check status / Retry, Paystack log with alerts + refund).
Walked: pay → "sent" → Check status → paid (Paystack credited in the
timeline) → seller sees it with reference; hold one order with a reason →
payout drops to that order's net → seller banner names the order and reason.
11 new API tests cover every path (holds, webhook settle/fail/mismatch,
timeout + same-reference retry, definite failure, expiry decisions,
paid-after-close).

## 10. Admin console complete + vendor Account (verified in sandbox)
Every admin screen is now real (no placeholders): Overview, Orders,
Payouts, Buyer reviews, Sellers, Appeals, Listings, Categories, Homepage,
Campaigns, Guides, Analytics. Vendor: Home, Orders, Products, Money, Shop,
Account.
- **Orders:** Late first; each seller's part with the promise vs. now,
  payment in plain words (cash due/collected), timeline, "Hold this order's
  payout".
- **Sellers:** applications first; approve, suspend (reason required),
  commission (audited), trust badges with the buyer-facing meaning, payout
  account status.
- **Appeals / Buyer reviews:** decisions need a note; appeal outcomes are
  written into the listing's review history; review flags for contact
  details / scam wording.
- **Categories:** tree with departments bold + sub-category counts, only
  exceptions badged; rename, menu/assignable toggles, make proposals live,
  retire with a replacement; "Worth a look" suggestions.
- **Homepage:** one editor + real Preview — a 30-min signed preview link
  (`POST /admin/homepage/preview-token`, `pv1.` HMAC, not a session) opens
  the storefront with the draft and a "not live" bar; save/publish/schedule,
  reorder, hide, timed sections, per-type fields in plain words; save errors
  name the section.
- **Campaigns / Guides:** full lifecycle (draft → approval → live → ended;
  guides draft/publish with product picks and refresh reminders).
- **Analytics:** search insights from `search_query_log`
  (`GET /admin/search/insights`) — volume, found-nothing rate, top and
  failed searches with one-tap fixes (synonym/redirect), seller-proposed
  words to approve.
- **Vendor Account:** sign-in email + reset link (no new auth before
  WorkOS), dispatch location (region, town, GhanaPost GPS, optional pin),
  dashboard alert toggles.
- **Date/time pickers:** all native `type=date|time|datetime-local` inputs
  replaced by kit `DateTimePicker` / `DatePicker` / `TimeSelect` (quick
  picks, month grid, 12h times).
Bugs found and fixed:
- **Trust badges:** created as `pending` and never verified, while the shop
  page showed every badge incl. revoked; the public endpoint also returned
  the private evidence (could hold ID numbers). Issued = verified; public
  shows only verified, without evidence; 0039 carries existing badges over.
- **Homepage couldn't be saved at all:** the API rejected the shared
  `top_rated` source and the default empty "all departments" section. Both
  fixed; a test now saves the default homepage.
- Store homepage route lacked the signing secret (preview); retire/location/
  password copy corrected to match behaviour; payout tasks include reversed.
Walked: badge issue → public shows it without evidence; "phone" found
nothing → Analytics Fix (means "tecno") → search "phone" returns Tecno Spark;
schedule via the new picker; category tree; orders/sellers sheets.

## 11. PostHog switched on (storefront only)
- Project is in the **US** region (`https://us.i.posthog.com`); the public
  `phc_` key is in `apps/storefront-v2/.env.local` (gitignored). Production
  needs `VITE_PUBLIC_POSTHOG_KEY` + `VITE_PUBLIC_POSTHOG_HOST` at build time.
- Safety: only `phc_` keys are accepted (a personal `phx_` key is refused);
  PII keys are stripped from event props (existing); Do Not Track respected;
  a "Usage analytics" switch on /privacy opts a device out; session replay
  masks every input and anything marked `data-ph-mask` / `.ph-no-capture`.
- Verified: posthog-js loads with the intended config and PostHog accepted
  a test event (`alkemart_setup_check`).
- Fixed: MoMo and card orders never sent `order_completed` (they finish on
  the payment-status screen, not checkout) — now sent once per order.

## 12. Storefront pages redone (phone-first) + newsletter
- **Categories:** compact department cards with sub-category chips (≈2
  departments per phone screen, not 1), a jump strip on phones, coloured
  icon tiles where art is missing (only 6/13 departments have art — no
  empty boxes, no failed image requests). One search box: the header's
  (it already suggests categories, shops and products).
- **Stores:** shops start under the title (banner + promise cards removed),
  one row of chips (Recommended, Near me, Top rated, Fast delivery, Only
  {area}, A–Z), delivery promise on every card. Removed the duplicate
  search and duplicate "Deliver to". API list now carries `deliveryDays`.
- **Product page — blocker fixed:** a two-seller product whose comparison
  wasn't allowed yet could not be bought ("Choose a seller" with nothing to
  choose). Now the best offer is preselected by a stated, neutral rule
  (lowest total = price + delivery, labelled "Best price"); nothing is
  picked while offers load; stale picks fall back instead of dead-ending.
- **Comparison redesigned:** each seller is one selectable card (radio group,
  keyboard arrows), total first with the item + delivery breakdown, "GH₵X
  more than the best price", Best price / Top rated badges, terms. "Sold by
  … · Compare N sellers" beside the price. Home comparison card matches.
- **Spacing:** product page tightened (empty rating row, 48px gaps on
  phones, oversized empty gallery), category title above its chips, name
  fields side by side at checkout, duplicate "Sold by" relabelled.
- **Cart / checkout:** one checkout button on phones (sticky bar), "Clear
  cart" now asks first; checkout has a logo-only header (no search/menus to
  wander off to) and shows each seller's delivery promise.
- **Footer:** slim on phones (help, trust, legal + payment logos); full on
  desktop.
- **Newsletter (0040):** double opt-in — signup sends a signed confirm link
  (the email address never sits readable in the URL), only confirmed
  addresses count, one-tap unsubscribe forever, rate-limited, one confirm
  email per address per day. Walked: footer signup → email in the log →
  link → "You're subscribed".
- **Also:** legacy region slugs ("greater_accra") now display as names
  everywhere; admin order screen shows an existing payout hold instead of
  offering a second one; payouts check the Paystack balance first (real
  Paystack only) and explain a shortfall.
- Docs: `SEARCH-ENGINE.md` (stay on Postgres; Meilisearch when zero-results
  stay >15% or the catalogue grows), `docs/design/ASSETS-FOR-CODEX.md`
  (every missing image, exact path and size).

## 13. Real Paystack test mode + storefront accessibility pass
- Sandbox can talk to Paystack's real **test** API (`SANDBOX_REAL_PAYSTACK=1`,
  key read from `.dev.vars`, anything but `sk_test_` refused). Proven:
  recipient creation, balance pre-check, MoMo charge → verify → order,
  signed webhook (tampered/unsigned refused, duplicates harmless), transfer
  creation (stopped at `otp` — account setting). Results in
  `PAYSTACK-TRUST.md`. Sandbox prices are now realistic (GH₵1,850 phone,
  GH₵400 earbuds, GH₵30–45 delivery).
- Buyers no longer see Paystack's raw error text when a payment can't start
  (logged for support instead); stock release on failure confirmed.
- Accessibility pass (phone width) on home, categories, stores, product,
  search, cart, checkout, sign-in, newsletter: alt text, accessible names,
  labelled fields, unique ids, one h1, no skipped heading levels, tap targets
  ≥ 24px. Fixed: small "See all"/breadcrumb/back/forgot-password links, 36px
  save hearts → 40px, skipped heading levels on stores/search (screen-reader
  h2), missing h1 on empty cart/checkout, a link nested inside the seller
  radio card. Not covered by this automated pass: colour contrast and a
  full keyboard-only walk.

## 14. Seller setup stepper, pinpoint location (sellers and buyers), quiet sidebar

- **Setup stepper** (`vendor-v2` `/setup`): register → five steps, saved as
  you go, resumable, skippable except location + payouts. Reuses the Shop
  sections via a flow context (`components/shop/shared.ts`), so there is one
  form per topic. Home/Shop show progress until done. Shop page is now tabs
  instead of nine stacked cards; "Open for orders" is a one-line strip.
  Dispatch location moved from Account to Shop → Location; the MoMo form moved
  into the shared sections (Money uses the same one).
- **Pinpoint location**: new `packages/maps` (`LocationPicker`, Leaflet
  loaded on demand, OSM tiles): street/landmark search (inline results, no
  popover), "Use my current location" with accuracy, centre-pin map, reverse
  lookup fills street/area/town/region. Wheel zoom only after the map is
  tapped, so page scroll isn't hijacked. API `GET /store/places/search|reverse`
  (`lib/geocoder.ts`, Ghana bounds, 40/min per IP, shared-cacheable search,
  private-only reverse). Proven in the sandbox: search "Madina Zongo
  Junction" / "Oxford Street Osu" → pin → saved to the seller; buyer pinned
  "Kejetia Market" at checkout → town/region auto-filled → COD order → the
  seller's order shows "Buyer pinned their spot · open in Maps".
- **Before launch (ops):** the public OpenStreetMap geocoder and tiles are for
  light/dev use only. Set `GEOCODER_URL` + `GEOCODER_KEY` (e.g. LocationIQ,
  Nominatim-compatible) on the Worker, and pass a tile provider to the picker
  (`tileUrl`) — MapTiler/Stadia/CARTO. Apply migration 0041.
- **Sidebar**: `scroll-quiet` utility in console-ui — no visible scrollbar at
  rest, thin thumb only on hover/focus (vendor + admin sidebars).
- Also fixed: `OfferSelection` type was missing `bestOfferId`/`autoPicked`
  (storefront tsc); vendor tsconfig lacked `DOM.Iterable`.
- Tests: API 299 (+9 geocoder/places), storefront 104, vendor 4 (new: setup
  progress). tsc + lint clean on api, vendor-v2, admin-v2, storefront-v2.

## 15. Pilot phase 1: delivery options, trust-by-default handover

- Plan and verification approach documented: `PILOT-PLAN.md`,
  `VERIFICATION.md` (ID checks deferred; pilot runs with known shops).
- Domain `delivery-options.ts`: zones by pin distance or typed town/region,
  pickup, handover code (unbiased 4 digits, constant-time match), payout
  release window, and an admin-tunable `DeliveryPolicy` with defaults.
- API: `/store/checkout/options`; checkout freezes per-seller choice and fee on
  the intent and orders (server-priced, never from the client); seller
  `PATCH /me/fulfillment`; deliver with optional code (one tap, from placed or
  shipped); buyer received / problem / sorted; payouts skip orders still in
  their report window; admin `/admin/settings/delivery-policy`; settings store
  over `platform_settings`.
- Direction changed mid-build on the owner's call: no admin confirmation
  step — sellers are trusted, buyers can object, admin handles exceptions.
- Bugs fixed on the way: saving only the delivery fee wiped the seller's
  address, pin, promise and contact (address route replaced metadata instead
  of merging); in-memory seller store overwrote fields with `undefined`;
  COD orders said "included in your next payout".
- Proven in the sandbox: seller set zones (town 30, region 45, no other
  regions, pickup on) → buyer in Kumasi saw pickup only, Tema saw delivery 45
  or free pickup → pickup order → buyer page code + pickup spot + directions
  → seller confirmed with the code → "Collected — confirmed by the buyer";
  admin changed the multi-day window to 36h and it saved.
- Tests: domain 125, API 316, storefront 104, vendor 4. Apply migration 0042.

## 16. Pilot phase 2: business overview and frozen statements

- Domain `business.ts`: ranges in the market's clock (presets, years,
  since joining, all time, custom; max 10 years), previous period, day/week/
  month buckets, `summarize` (sales, commission per seller rate, take-home,
  buyers, repeat buyers, shares, best sellers, regions, shops), monthly
  `buildStatement` (sales dated by delivery, payouts by payment), canonical
  JSON + SHA-256 fingerprint. Market config gained `utcOffsetMinutes`.
- API: `listOrderFacts` / `listPayoutFacts` (memory + Postgres), statement
  store (0043), `/vendor/business/*` and `/admin/business/*` (overview, orders
  CSV, statements list/detail/CSV). Statements freeze on first read after the
  month ends; the current month is a live preview. CSV: readable local dates,
  short order numbers, no buyer contact details, formula-safe cells, UTF-8 BOM.
  CORS exposes `Content-Disposition` so downloads keep their names.
- Kit (shared by seller and admin apps): `RangePicker`, `BusinessOverviewView`,
  `StatementView` (printable; console chrome hides in print), `downloadFile`.
- Sandbox seeds ~14 months of varied history (two shops, pay-on-delivery and
  MoMo, five regions, monthly payouts) so every view can be walked.
- Proven in the sandbox: seller 12-month overview with comparisons, since
  joining, statement for August (4 sales, 1 payout, fingerprint matches) and
  its CSV (`seller-a-statement-2026-08.csv`); admin all-time platform view
  (no misleading comparisons), one shop's 3-month weekly view; phone width.
- Tests: domain 141, API 325, storefront 104, vendor 4. Apply migration 0043.

## 17. Pilot phase 3: returns, disputes and Buyer Protection

- **Direction (owner, 2026-09-26):** no separate escrow product for the pilot.
  Online payments already sit in alkemart's Paystack balance until the buyer
  has the order (phase 1), which is a short, delivery-tied escrow; phase 3
  refunds come out of that. Stricter per-seller holding (Paystack subaccounts,
  manual settlement) is deferred. Cash orders are protected by reputation.
- Domain `returns.ts`: reasons and windows (change of mind = shop's returns
  days from the policy version in force when the order was placed, platform
  default if none, 0 = none; faulty/wrong/not as described = at least the
  platform's fault window; "never arrived" while on the way or after a
  seller-only delivery, online only), the case state machine
  (`nextReturnStep`), deadlines (`dueReturnAction`), refund split
  (`refundShares`), recoveries (`applyRecoveries`), `payableSubtotal`, shop and
  buyer return records, admin-tunable `ReturnPolicy`.
- Data 0044; repository methods in memory and Postgres (create with payout
  hold, compare-and-swap step, refund + ledger + hold release in one
  transaction, recoveries applied in `reservePayout`, undone on a failed or
  reversed payout; a refund on an order inside a failed payout cancels its
  recovery so the seller isn't charged twice).
- API: buyer `POST /store/orders/:id/return` and `/return/respond`; order
  JSON carries `returnCase`, `returnOptions`, `refundedPesewas`; "It's sorted"
  also withdraws a case. Seller `/vendor/returns` (list, accept, offer,
  decline, item-back, refund-paid); order detail has the case and its payout.
  Admin `/admin/returns` (views decide/open/refunds/closed, detail with both
  sides' history, decide, retry refund; audit-logged) and
  `/admin/settings/return-policy`. `/store/protection` (public numbers).
  Paystack refunds on close; `refund.processed/failed` webhooks settle them.
  Deadlines swept on every read (and by any caller of `sweepDueReturns`).
  Emails to the other side at every step.
- UI: buyer "There's a problem" asks what's wrong (with each reason's last
  day) and what they want, then shows the case with its next step. Seller:
  return card on the order with one-tap answers, a Returns tab with a
  "your reply" badge, a Home task, Money shows refunds taken from payouts.
  Admin: Returns & disputes (nav badge), inline decision with amount and
  reason, Rules card. Buyer Protection line on product, checkout and order
  pages; shop header "Settles returns: N of M" once there are 3+ cases.
  Shared `ReturnCaseCard` in console-ui.
- Bugs found and fixed on the way: `/checkout/card-callback` and
  `/checkout/pending` rendered the checkout form (no `<Outlet/>` under
  `checkout.tsx` → now `checkout.index.tsx`) — card and MoMo returns never
  showed their status; paid online orders read `paymentStatus: "pending"`
  (intent is `completed`, not `succeeded`, once the order exists); seller
  order page said "in your next payout" for orders already paid out; wording
  that claimed a payout was waiting on pay-on-delivery orders. Sandbox gained
  fake card/MoMo charge + refund and `POST /__sandbox/clock` for deadlines.
- Proven in the sandbox: seller set 3-day returns → card order delivered with
  the code and paid out → buyer (desktop) saw change of mind until the 3rd
  day and faults until the 7th, asked for a refund → seller declined with a
  reason → buyer (375px) escalated → admin partially refunded GH₵925 via
  Paystack; seller's GH₵860.25 share shown as owed from the next payout.
  Pay on delivery at 375px: change of mind → seller "once I have it back" →
  "I've got it back" → "I've paid the buyer back" → buyer sees it. Silent
  seller: clock +49h → case in admin's queue → full refund. Shop page record,
  Buyer Protection on product/checkout, admin two-sided history.
- Tests: domain 160, API 336 (returns 11), storefront 104, vendor 4. Apply migration 0044. (Under heavy load two business-overview tests can time out; they pass on their own.)

## 18. Pilot phase 4: messaging and product Q&A

- Domain `messaging.ts`: contact detection (Ghana numbers written any way,
  emails, "send momo / WhatsApp / pay direct") → "pay only through alkemart"
  warning (never blocks — people share numbers for delivery); quick replies
  per side; reply-time median (ignored buyers count as waiting) and label;
  plain-language text rules.
- Data 0045, `MessagesStore` (memory + Postgres). One thread per buyer +
  seller + subject (product, order, or general).
- API: buyer `/store/messages` (sign-in required; start about a product or
  their own order; read; send; report; block/unblock), `/store/questions`
  (public answered Q&A; ask a seller who sells the product). Seller
  `/vendor/messages` (inbox, thread, reply, report, block, questions +
  answers). Admin `/admin/messages` — reads **only reported** threads (each
  read audit-logged), close or dismiss; hide/show questions. Shop page gets
  "Usually replies within …" once there are 3+ conversations. Emails at most
  once per thread per hour. Writes rate-limited.
- UI: storefront inbox, conversation, "Message the shop" (product seller
  panel, order page), Questions section on product pages, Messages tile in
  Account. Seller: header inbox badge, Messages (Chats · Questions · Offers),
  conversation page. Admin: Reports page (nav badge). Shared chat bubbles and
  composer in console-ui.
- Fixed on the way: admin report list showed "General" instead of the
  product; "No returns" chip now says "No change-of-mind returns".
- Proven in the sandbox: buyer "Is it available?" (quick reply) → seller
  (375px) replies with a phone number and "send the momo" → warning under
  the message on both sides; buyer asks a question → seller answers → public
  on the product page; buyer reports → admin reads and closes → buyer can't
  send.
- Tests: domain +6, API messages 5. Apply migration 0045.

## 19. Pilot phase 5: make an offer

- Domain `deals.ts`: `judgeBuyerOffer` (refuses non-negotiable, over-price,
  too-low, too-many-open; auto-declines under the hidden floor without
  revealing it), `nextDealStep` (accept / counter / decline / withdraw /
  expire), `dealPriceFor` (only that buyer, listing and exact quantity, while
  valid), admin-tunable `DealPolicy` (valid hours, reply hours, lowest %,
  open offers per buyer).
- Data 0046, `DealsStore` (memory + Postgres; negotiation settings kept out of
  the big catalogue tables). Deal prices frozen on the payment intent and
  applied by `quote` and `confirmPaidOrder` in both checkout repos. An
  accepted price is spent by the checkout that uses it.
- API: `/store/deals` (negotiable flags public; offer, accept/decline counter,
  withdraw), `/vendor/deals` (inbox, accept/counter/decline, settings per
  listing with floor), `/admin/settings/deal-policy`. Cart and checkout
  recognise the signed-in buyer (session sent by the storefront; the cart
  uses a light session-secret binding) and price deal lines server-side.
- UI: "Make an offer" on product pages for negotiable listings with the
  buyer's latest offer and next step inline; cart line "Your offer price
  (was …)". Seller: "Buyers can make offers" + hidden lowest price on each
  price row; Offers tab (accept / counter / decline). Admin Rules card.
- Fixed on the way: storefront cart divided by a hard-coded 100 (now the
  market's minor units); cart and checkout never sent the buyer's session;
  seller price/stock labels sat on the same line as their inputs on phones.
- Proven in the sandbox: seller turned offers on with a GH₵1,600 floor →
  buyer offered 1,500 → declined automatically ("won't go that low") →
  offered 1,700 → seller (375px) countered 1,780 → buyer accepted → cart
  showed 1,780 (was 1,850) → pay-on-delivery order stored at 1,780 + 30;
  deal marked used.
- Tests: domain +8, API deals 3. Apply migration 0046.

## 20. Phase 6 paused for the MVP

On the owner's call (2026-09-27) feature work stops here. Phase 6 backend
exists but is **not mounted and not proven**: "sell one like this"
(`addOfferToExistingProduct` in both catalogue repos, `routes/vendor/catalogue.ts`),
video links (`parseVideoLink`, `VideosStore`, vendor/store/admin routes),
photo spec reading (`lib/photo-specs.ts`, off behind `PHOTO_READING_ENABLED`).
No screens. Migration 0047 only matters once it's switched on. Phase 7
(commission by category) not started.

## 21. Returns simplified, Make an offer parked (owner, 2026-09-27)

- Returns now: seller **refund in full / send a replacement / decline with a
  reason**; buyer accepts a decline or asks alkemart; admin **refunds in full
  or sides with the seller** — nothing else. Removed: seller partial-refund
  and replacement offers, the "waiting for the item back" step, admin partial
  refunds, the "item back" rule. Statuses are now requested / declined /
  escalated / closed. Migration 0044 (never applied) updated to match: no
  `offer` column, four statuses.
- Seller API: `POST /vendor/returns/:id/{refund,replace,decline,refund-paid}`.
  Admin API: `POST /admin/returns/:id/decide` `{ outcome: refund|declined, note }`.
- Make an offer parked: `/store/deals` and `/vendor/deals` not mounted, product
  page "Make an offer", seller Offers tab and per-listing setting, and admin
  rules card removed; carts and checkout never apply deal prices. The deal
  route tests are skipped until it returns.
- Further trimmed on the owner's call: no buyer deadline after a decline; no
  public "Settles returns" record; no buyer/seller return history in admin;
  no "never arrived" reason (returns start after delivery); return windows
  are fixed domain defaults (admin Rules card and `/admin/settings/return-policy`
  removed). Kept: a refund on an already-paid order comes off the seller's
  next payout.
- Payouts: admin → Payouts → **Pay everyone ready** (`POST /admin/payouts/run`)
  sends every seller whose money is released in one press; skips sellers on
  account hold, without a MoMo payout account, or with a payout already on its
  way (same reserve → send → settle path and reference as the single Pay).
  Proven in the sandbox.
- **Automatic payouts** (owner, 2026-09-27): released money is sent to the
  seller's MoMo without an admin press — code or "I got it" at once; seller-only
  deliveries when the report window ends (`auto-payout` queue job, seller's
  Money page as backstop); after "It's sorted", a closed return, a released
  hold, or the previous payout landing. Shared payout path in
  `apps/api/src/lib/payouts.ts`; policy `DEFAULT_PAYOUT_POLICY` in the domain.
  Tests: `routes/store/auto-payout.test.ts`. Proven in the sandbox (code → paid;
  seller-only → waits the window; first payout confirmed → next one sent).
- Owner, later the same day: **automatic payouts switched off** for the pilot
  (policy flag; code, queue job and tests kept — `auto-payout.test.ts` is
  skipped until it's on). Admin pays daily with "Pay everyone ready".
  Escrow choices for after the pilot: `ESCROW-OPTIONS.md`.
- **No commission for the pilot**: Ghana `defaultCommissionBps` 0, migration
  `0049_no_commission.sql` (default 0 + every seller to 0), demo shops 0.
  Seller Money page hides commission lines at 0%. `ledger.test.ts` sets its own
  7% shop so the fee maths stays covered.
- **⚖ Compare mode, step 1** (migration `0048_compare.sql`: `compare_wallets`,
  `comparisons`). Domain `compare.ts` (`DEFAULT_COMPARE_POLICY`: 5 tokens, top
  up to 5 every 14 days, 2–4 items; lazy top-up, no job). API
  `/store/compare` (`GET /tokens`, `POST /` spends one token atomically and
  saves the comparison, `GET /:id` reopens free — owner only). Storefront:
  Compare switch on search results, pick buttons on cards, floating bar with
  compares left, `/compare/$id` side-by-side table (delivered price with
  "Lowest", price, delivery, shop, shops selling it, rating, returns, stock,
  condition/warranty, attributes). Admin Appeals icon changed so ⚖ means
  compare. Tests: `compare.test.ts` (API), `compare.test.ts` (domain).
  Sandbox has a second phone (itel A70) to compare. Proven in the sandbox,
  desktop and 375px.

