# Pilot plan — known shops first

Written 2026-09-26. The pilot runs with shops the team knows and onboards by
hand; public seller sign-up and ID verification come later
(`VERIFICATION.md`). Each phase ships only when it's proven in the sandbox by
walking the real workflow.

## Phase 1 — Delivery that fits Ghana (trust core) — **built 2026-09-26**

Principle: **trust by default, exceptions through reports.** Sellers are known
and run their own shops; nobody checks every delivery.

- **Delivery options per seller:** fee per zone (same town / same region /
  other regions, or "don't deliver there") and **pickup from the shop**
  (free). Priced server-side from where the buyer is (map pin wins over typed
  town/region), chosen per seller at checkout, frozen on the order.
- **Seller marks delivered in one tap**, always — even straight from "placed".
- **Handover code (optional proof):** every order gets a 4-digit code the buyer
  gives the rider or shows at pickup. With it (or the buyer's own "I got it")
  an online payout is released at once. On the seller's word alone the buyer
  gets a short report window first (same-day orders 24h, others 48h).
  Pay-on-delivery is unaffected — the seller already has the cash.
- **Buyer:** "I got it" / "I collected it" (a delivery only once it's sent,
  with a confirm step, because it pays the seller), "There's a problem" (holds
  only that order's payout and emails the seller), "It's sorted" (releases it).
- **Admin is out of the everyday flow.** The numbers (report windows, code
  tries, same-town km) are one delivery policy with domain defaults, tunable in
  admin → Rules (audited). Admin steps in only when a report can't be settled.

## Phase 2 — Records and business overview — **built 2026-09-26**

- **Overview for any period**, for a seller (their shop) and admin (the whole
  platform, or any one shop — the exact view its seller sees): 7 / 30 days,
  3 / 12 months, this year, any past year since joining, since joining / all
  time, or custom dates. Compared with the same length of time just before
  (not shown for "all time" / "since joining").
- Numbers: sales, orders (and cancelled), what the seller keeps / commission
  earned, average order, buyers and repeat buyers, delivered, pay-on-delivery
  and pickup share, active and new shops (admin), best sellers, top shops
  (admin), where buyers are; a sales chart by day, week or month.
- **Every order in the range as a CSV** (no buyer emails or phones).
- **Monthly statements, frozen:** a sale is dated when delivered, a payout
  when paid, so a closed month never changes; later corrections land in a
  later month. Frozen on first view after the month ends (no admin step),
  stored with a SHA-256 fingerprint of its canonical data and re-checked on
  every view. The current month is a live preview. CSV and print/PDF.

## Phase 3 — Returns and disputes — **built 2026-09-26**

- Builds on phase 1's "There's a problem" (already holds the order's payout).
- Buyer asks for a return within the seller's policy window after delivery.
- Seller accepts or declines with a reason; admin decides only what the two
  can't settle (escalation if the seller doesn't reply in 48h).
- Online payments refunded through Paystack; pay-on-delivery refunds recorded.

### Build plan (2026-09-26)

- **One case per order at a time** (`return_cases`, 0044). "There's a problem"
  now asks what's wrong (damaged, wrong item, not as described, changed my
  mind) and what the buyer wants (money back or a
  replacement). "Just tell the seller" stays the phase-1 note.
- **Windows, from the domain** (`returns.ts`): change of mind only within the
  shop's returns days (policy version in force when the order was placed;
  platform default if the shop set none; 0 = no change-of-mind returns).
  Faulty / wrong / not as described: at least the platform's fault window,
  even if the shop takes no returns.
- **Simplified (owner, 2026-09-27).** The seller does one of three things:
  **refund in full**, **send a replacement**, or **decline with a reason**.
  No counter-offers, no partial refunds, no separate "item back" step (if the
  seller wants the item first, they agree it with the buyer in Messages).
- **Buyer** accepts a decline, asks alkemart to decide, or says it's sorted
  (no deadline on the buyer; the order's payout waits until they answer).
  **Seller silent** past the reply time → goes to admin. Checked whenever a
  buyer, seller or admin opens returns or orders (the admin nav badge reads it
  on every admin page). `scheduled()` also sweeps, but no cron trigger is
  configured — Queues replaced cron (wrangler.toml). Returns open only after delivery (no "never arrived"
  reason). Windows are fixed domain defaults (7-day faulty, 7-day default
  change of mind, 48h seller reply), not admin settings.
- **Admin** sees only cases that need a decision and has two choices:
  **refund the buyer in full** or **side with the seller**, with a reason both
  see. Audit-logged.
- **Money**: online → Paystack refund of the full item amount; the
  order's payable amount drops, commission with it. If the order was already
  paid out, the seller's share is recovered from their next payout. Pay on
  delivery → the seller pays the buyer back and records it. The order's
  payout stays held while a case is open. Refund ledger rows.
- Proven in the sandbox as buyer, seller and admin, desktop and 375px.
- **Escrow decision (owner, 2026-09-26):** no separate escrow product for the
  pilot. Online money already waits in alkemart's Paystack balance until the
  buyer has the order; that is shown to buyers as **alkemart Buyer
  Protection** (product, checkout, order pages).
- **Payouts for the pilot (owner, 2026-09-27):** the handover code (or "I got
  it") releases the money; admin pays every released seller once a day with
  **Pay everyone ready**. Automatic payouts are built but **off**
  (`DEFAULT_PAYOUT_POLICY.autoPayout = false`); the escrow choices to make after
  the pilot are in `ESCROW-OPTIONS.md`.
- **No commission for the pilot (owner, 2026-09-27):** sellers keep the full
  price (market default 0%, migration 0049 sets every seller to 0). The
  per-seller rate stays so admin can set one later. The business model is
  seller plans (paid tiers for reach, Jiji-style); tiers, prices and perks are
  the owner's to decide before that is built; pilot payments are manual (MoMo
  to alkemart, admin confirms).

## Compare first — the MVP core — **step 1 built 2026-09-27**

Alkemart's promise, after the Mowafer reference: *the best price, compared.*
The ⚖ scales is the symbol of comparing. It is a **feature you switch on**,
not a button on every product card: cards stay clean, and sellers don't feel
every listing is a price fight.

### What already exists (keep)

- Same product, several shops: the product page lists **other sellers** of
  the identical item, sorted by **total delivered price** (price + delivery to
  the buyer), with a "Best price" badge and price history per offer
  (`GET /store/products/:id/peers`).
- Comparison only between items proven to be the same product (identity
  check, `comparisonEligible`); unreviewed listings never compare. This is
  what keeps it fair to sellers.

### Free for every buyer (the hook)

1. **Best price everywhere a product appears** — "From GH₵X · N shops" on
   cards and search results. No scales icon on cards.
2. **Other sellers on the product page** — as today, sorted by delivered
   total, so the cheapest *to your door* wins, not just the cheapest sticker.

### ⚖ Compare mode (uses tokens)

3. In **search**, a ⚖ **Compare** switch. On: the buyer picks up to 4
   results and gets one side-by-side page — delivered price to their area,
   key specs, rating, shop, return days. **Opening a comparison uses 1 token.**
4. **Price-drop alert** from that page: "tell me when it's under GH₵X" —
   **1 token per alert**, message when it happens.

### Tokens

5. **5 tokens on sign-up, topped back up to 5 every two weeks** (owner,
   2026-09-27). Free during the pilot; no token packs until the market shows
   the need. Shown with the ⚖ in the account and in Compare mode ("3
   compares left").
6. Tokens are **credits, not money**: no cash value, not refundable, not
   transferable.
7. The numbers (grant, refill period) live in the domain with defaults and are
   **per market**, so each country can set its own later.

### Sellers pay for price insight

8. **Price position** in the seller app: for each listing that is compared,
   where your delivered price stands ("GH₵70 above the cheapest in Accra")
   and how often buyers compared it. Paid (plan or credits — decision below).
   Sellers never see who compared, only counts and positions.

### Decisions needed from the owner before building

- **Seller insight pricing:** monthly plan, or pay per report?
- **Points at checkout** (Mowafer's "Use Points" discount) — leave out for the
  MVP? (Recommended: yes, leave out; tokens are for comparing only.)

### Build order (each proven in the sandbox before the next)

1. ✅ Compare mode (2–4 items side by side) + token balance with the sign-up
   grant and two-week top-up. The "From GH₵X · N sellers" line on cards
   already existed.
2. Price-drop alerts.
3. Seller price insight.
4. Token packs — only if pilot use shows the need.

## Phase 4 — Messaging and product Q&A — **built 2026-09-26**

- Chat tied to a product or order, quick replies ("Is it available?").
- Phone and MoMo numbers in messages trigger a "pay only through alkemart"
  warning; report and block; admin reads only reported threads.
- Reply time on the shop page. Public Q&A on product pages.

## Phase 5 — Make an offer — **parked (owner, 2026-09-27)**

- Seller marks a listing negotiable, with an optional hidden floor.
- Buyer offers → auto-decline below floor → seller accepts / counters /
  declines → accepted price valid 24h for that buyer at checkout.
- Built and proven, then parked so the MVP centres on price comparison:
  routes not mounted, screens removed, no deal prices reach carts or checkout
  (`DEALS_ENABLED = false`). Code and migration 0046 kept for later.

## Phase 6 — Faster listing and videos — **paused for the MVP (backend drafted, not mounted)**

- "Sell one like this": add an offer to an existing catalogue product.
- Photo spec reading (label, box, settings screen) with confirm-before-save;
  small free allowance, more on plans.
- TikTok / Instagram / YouTube video links on products, click-to-load, admin
  approval queue, "Watch & shop" row for featured ones. Uploads (Cloudflare
  Stream) later.

## Phase 7 — Monetization settings (admin) — **not started (after the MVP)**

- Commission by category with per-seller overrides and dated promos
  ("0% for 60 days"); each order keeps the rate it was placed under.
- Later, when traffic exists: Sponsored placements (always labelled, never
  change "Best price") and seller plans as editable perk lists.

## Deferred until pilot data says so

- Buyer phone OTP and "pay the delivery fee first" on pay-on-delivery orders
  — switch on if refusal rates are high.
- ID verification (`VERIFICATION.md`).
- Pickup points, partner riders, messaging over WebSockets, loans.
- Stricter escrow: per-seller Paystack subaccounts with manual settlement, so
  Paystack (not alkemart) holds the seller's share until delivery. Check Bank
  of Ghana (Act 987) and Paystack hold limits before scaling holds.
- Refunds and cash-order commission corrections on monthly statements and the
  business overview.
