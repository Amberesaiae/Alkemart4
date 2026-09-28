# Navigation / click matrix (Workers)

Purpose: manual QA (and optional future browser automation) cover **every Workers-visible primary control**. Mercur-only leftovers are asserted unlinked, not exercised. Browser Playwright is deferred; use this matrix by hand against Pages.

## Storefront

Cold reload: boot spinner stays 44px through stylesheet arrival and app handoff;
no enlarged logo flashes before the page appears.

State artwork QA: empty cart → Start shopping; saved items → Explore products;
unmatched search → clear filters; empty orders/messages retain existing guidance;
unknown URL → Go home/Search; failed loads → retry (offline device on a dropped
connection). No success artwork on a failed order lookup. Seller Products with
zero listings → corrected kiosk/Add product; unmatched product search → magnifier;
empty Orders → parcel; Messages/questions → envelope. Completed seller setup
shows shop artwork while retaining the explicit approval requirement.
Admin: empty top products → parcel; empty top shops/visits → kiosk; empty searches
→ magnifier; conversations/questions → envelopes. Orders/sellers with unmatched
search terms use search artwork and matching guidance rather than first-use copy.
Vendor: empty shop views → compact kiosk; no delivered orders in Money → parcel,
with See orders unchanged. Populated data and payout/moderation states stay clear.

Footer: the gold seller invitation spans the full width. Weekly-deals signup
sits below the desktop link columns in the dark footer; on mobile it sits
inside the footer before help/legal links. Preserve email validation and
double-opt-in confirmation when checking signup.
The seller strip is compact, with a bold responsive 30–36px headline, 16–18px
shop-management copy and a solid dark Start selling button. Headline, copy and
button form one centred vertical invitation on desktop and mobile. Newsletter signup uses
an envelope icon and an integrated email/button field, without separator lines.
A faint decorative brand silhouette anchors the desktop footer; keep it hidden
from assistive technology and clear of interactive controls.

On reload and route waits, assert the logo stays in its original orientation
while only petal colour intensity changes. Check both the initial HTML boot
loader and React loading states; reduced motion keeps the entire mark static.

| Route | Must click / assert |
|-------|---------------------|
| `/` | Brand, category rail, product card → PDP, search submit |
| `/search?q=` | Results or empty state |
| `/browse/$slug`, `/categories/$slug` | PLP cards |
| `/product/$id` | Offer pick, ATC, seller chip → shop |
| `/cart` | Qty change, remove, Place order → checkout |
| `/checkout` | Address fields, COD (default), place order |
| `/checkout/pending` | Polling UI (MoMo) |
| `/checkout/card-callback` | Returns to order/pending |
| `/orders`, `/order/$id` | List + detail + shipping shown |
| `/login` | Login / register toggle, submit |
| `/account` | Shell loads |
| `/shops`, `/shops/$slug` | Index + shop |
| `/help`, `/about`, `/contact`, `/delivery`, `/partners`, `/sell` | Content shell 200, no crash |
| `/order/$id/return` | Honest “not available” (no fake success) |
| `/account/wishlist` | Honest empty / unavailable on Workers |

Header/footer: account menu, orders, help, language control if present.

Desktop promo bands: compact headline/action presentation; cover artwork
sets the height from its natural aspect ratio so the full image is visible.
Eyebrow and supporting copy remain on mobile only.
Verify CTA destination and uncropped artwork, long-title wrapping, and the
unchanged mobile presentation. Other promo types/countdowns are unchanged.
The default deals-band rotates five desktop campaigns (four additions), with
calm Ghanaian story imagery (generated raster, no SVG campaign art). Delivery
and comparison lead, then discovery, selling and the original band. Check pause/play,
hover/focus pause, arrows, swipe, reduced motion and offscreen/tab visibility.
Only the active slide is accessible; mobile retains the single original band.
Asset provenance and campaign notes: apps/storefront-v2/docs/PROMO-CAMPAIGNS.md.

Desktop home department entry points match the reference's six (Electronics,
Fashion, Home & Living, Beauty, Gaming, Appliances), with 4:5 generated art,
live title/tagline safe zones and Hugeicons in hero/trust circles. Existing
API categories resolve by department identity; absent Gaming/Appliances use
search instead of invented taxonomy. Check all six links and image loading,
3-column tablet / 6-column desktop layout, and unchanged mobile homepage
categories/art. Loading skeletons are unchanged. Asset prompts and paths:
`apps/storefront-v2/docs/REFERENCE-DEPARTMENTS.md`.

Typography QA: body/navigation/inputs render at 16px, secondary copy at
14px under default settings. Verify home, catalogue, login and cart at
375px and desktop, then narrow/zoomed reflow: no clipped controls or
page-wide horizontal scrolling (product rails remain independently scrollable).
Mobile home is a deliberate exception: preserve its approved type scale
and layout; the larger scale applies to desktop home and other routes.

Storefront v2 footer: seller invitation and newsletter share one compact
gold section, divided side by side on desktop and stacked on phones.
There is no illustration or separate seller banner; skeletons are unchanged.
Verify Start selling opens the vendor app, and the
brand-gold newsletter band shows a labelled email field, dark Sign up button,
and confirmation/error feedback at desktop and 375px widths. Signup remains
double opt-in; do not submit live addresses as a visual test.

## Vendor

| Route | Must click / assert |
|-------|---------------------|
| `/login`, `/register` | Forms submit |
| `/` | Dashboard shell |
| `/products` | List / empty; open product; quick-sell entry |
| `/products/$id` | Edit fields save |
| `/orders`, `/orders/$id` | Ship / deliver when eligible |
| `/settings` | Ghana setup fields |
| `/returns` | Not in Workers nav |

Mobile tab bar: Dashboard / Products / Orders / Settings.

## Admin

| Route | Must click / assert |
|-------|---------------------|
| `/login` | Admin login |
| `/sellers-queue`, `/sellers`, `/sellers/$id` | Approve / suspend actions |
| `/product-moderation` | Approve / reject |
| `/orders`, `/orders/$id` | Detail |
| `/payouts` | Trigger payout form |

Assert analytics/markets/returns/etc. **not** in sidebar when Workers API.

## Cross-door smoke

1. Storefront Pages 200 + Alkemart brand  
2. Vendor Pages 200 + login heading  
3. Admin Pages 200 + login heading  
4. Dist / live storefront has **no** Medusa SDK chunk when Workers URL baked  
