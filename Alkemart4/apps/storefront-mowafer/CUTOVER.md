# storefront-mowafer cutover checklist

Lab app: `@workspace/storefront-mowafer` on **port 5176**.  
Production `apps/storefront` on **5175** stays the live buyer surface until this list is signed off.

Plan: `docs/superpowers/plans/2026-09-19-mowafer-storefront-rebuild.md`  
Spec pack: `docs/research/mowafer-behance-clone/`

**This task does not swap production deploy.**

---

## Acceptance walk (specs 02–08)

Walked against the lab implementation (tests + typecheck green). Visual smoke on a live `:5176` + Workers API should be repeated by a human before cutover.

| Spec | Status | Notes / gaps |
|------|--------|----------------|
| 02 tokens | Pass | `--primary #febf31`, `--foreground #3c3c3b`, `--dept-*`. Contract comment bans `bg-primary/N`. Montserrat in `index.html`. |
| 03 chrome | Pass with gaps | Header = logo · best-price search · Home/Stores/Purchases · account · cart. Rail cap 6, food last. **No** language switcher. Footer legal is copy, not Privacy/Terms routes. |
| 04 home | Pass | Mosaic → Last Offers (icon tabs) → Delivery → Advertise. Honest empties via `MerchEmpty`. View More pill only. |
| 05 PLP | Pass | Breadcrumb, hero, Radix filter strip, accent categories panel, dark sellers panel, Sheet on mobile. Ratings filter hidden until `ratingCount > 0`. |
| 06 PDP | Pass | One price in `BuyPanel`. Seller named. `PeerOffersList` only when `offerCount > 1`. Specs/Reviews tabs hide empty. Toast on ATC. Sticky buy bar `< md`. |
| 07 cart/checkout | Pass with gaps | Separate `/cart` + `/checkout`. Stepper address → delivery → payment → success. COD + Paystack card. **No** points. Track CTA currently returns to `/cart`; My Orders goes to `/login` (no `/orders` route yet). Category colour tags render only when the cart API hydrates category on the line. |
| 08 mobile | Pass | Bottom tabs Home · Offers · Search · Account (`md:hidden`). Offers → `/search?deals=1` (see `src/design/SPINE.md`). Main padded `pb-20`. Filters in Sheet. Sticky buy above tabs. Checkout single column. |

### Open issues to file before traffic swap

1. **Stores directory** (`/shops`) is still a stub listing — shop detail can load via `getSellerShop` once the index is wired to real sellers.
2. **Orders / track** — no buyer orders route; success CTAs are placeholders.
3. **Cart category tags** — confirm Workers cart payload includes `categoryHandle` / `categoryName`; otherwise tags stay empty (honest, not invented).
4. **Hero photography** — only shared `category-art` handles (electronics, food, health, pet) have photos; others use glyph/empty, never stock fill.
5. **Legal pages** — Privacy / Terms are footer labels, not routes.
6. **Human visual QA** on 390px + desktop with `VITE_ALKEMART_API_URL` pointed at local `:8787` or staging Worker.
7. **PWA / analytics / SEO** omitted on purpose (YAGNI until cutover).

---

## Cutover steps (do not run until QA sign-off)

1. Freeze features on `apps/storefront`.
2. Point Pages / `scripts/deploy-storefront.sh` at `apps/storefront-mowafer` build (`@workspace/storefront-mowafer`).
3. Redirect local 5175 → 5176 in the restart script after QA sign-off.
4. Archive or rename old storefront only after 48h soak.

Until then: `bun run dev:storefront-mowafer` from the Alkemart4 workspace root.
