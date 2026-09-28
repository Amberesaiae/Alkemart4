# Engineering standards — Workers era

Full doctrine: [`AGNOSTIC-APPROACH.md`](./AGNOSTIC-APPROACH.md).

Storefront loading marks keep the approved logo pose fixed. HTML boot and React
loaders share `public/brand/loading.css`: restrained colour highlights pulse
through all five shapes (four petals and the round head), one at a time, with
no orbiting ring. Each shape takes a half-second turn. Reduced motion
shows the static original mark.
The reusable React component is `packages/console-ui/src/components/brand-spinner.tsx`.
Storefront `BrandSpinner` re-exports it; shared console `Spinner` wraps it for
inline actions and toast loading. The shared package bundles the logo and motion
styles so seller/admin apps do not depend on storefront public asset URLs. The
storefront HTML boot frame retains the matching pre-React markup/styles.
Keep the fixed-size boot wrapper separate from `.brand-loading-mark`; late-loaded
shared styles must not override its dimensions and flash a viewport-size logo.

## Backend first principles

### Branded state artwork

`console-ui/components/brand-illustration` bundles the ten approved earlier
spot illustrations, including the corrected v4 kiosk. Storefront and console
state components use typed names, decorative empty alt text, responsive sizing,
and an icon fallback if loading fails. Never fetch nonexistent public WebP paths.
Use search artwork for successful empty search results, the parcel for no orders,
and kiosk/message artwork for console shop traffic and conversations. Dashboard
cards use `illustrationSize="compact"` (112–128px); page-level empty states retain
the larger default. Keep finance and moderation states icon-led when no approved
scene fits. Never decorate populated charts/tables or imply a payout succeeded.
Use the envelope for no messages, and the device only for connection failures.
Keep error/retry copy and actions intact. Order-success art requires a loaded
order, not just `placed=1`; shop setup art requires all setup steps complete and
does not imply approval (the existing approval caveat remains).

1. **Owned kernel** — marketplace rules live in `packages/domain` + `apps/api`, not in Medusa/Mercur.  
2. **Single writer** — Workers API is the only commerce write path.  
3. **Pesewas integers** — no float money in ledger or quotes.  
4. **Offer-bound cart** — ATC uses `offerId`; Product ≠ Offer.  
5. **Transactions for stock/money** — reserve / release / confirm / payout in DB txs.  
6. **Idempotent confirms** — webhooks and polls must not double-create OrderGroups.  
7. **Charge-before-commit for async MoMo** — pending + reserve, then webhook/poll.  
8. **Seller scope** — vendor routes never mutate another seller’s rows.  
9. **Fail closed** — missing Paystack / Hyperdrive / auth → explicit 4xx/5xx, not silent dual-path.  
10. **Migrate honestly** — prefer Drizzle; admin one-shots are ops escape hatches, documented.  
11. **Docs = code** — if behavior changes, update `docs/architecture/workers/` in the same change.  
12. **Ghana locale** — use `@alkemart/shared/ghana`; do not fork constants into SPAs.

## Frontend production practices

Storefront v2 uses one mobile reading scale below 768px across every route
and portalled sheet: page titles 22px, section headings 18px, product titles
and button/category labels 14px, prices 15px, small labels 12px. Form fields
and sort controls stay 16px to prevent iOS focus zoom. Standard shared buttons
and select triggers have a 44px minimum height; icon buttons also have a 44px
minimum width. Product shelves and grids share two-column card widths and
the same rounded-xl corners on phones. Category tiles use two columns and 4:5 frames; studio
art fits without cropping, while canonical photos use their framing metadata.
Desktop retains the larger reading scale (16px body/controls, 14px details).
Use rem units and check narrow layouts/reflow. The home-only scope now controls
composition (compact section headers), not a separate typography system.

Custom mobile quantity buttons, variant choices, login tabs/password toggles,
and native select fields follow the same 44px control target. Product-card
save/add icons retain their compact visible size with a 44px expanded hit
area. Cart rows stack price beneath the item title and let actions wrap on
narrow phones. Content heroes, guide cards and contact forms use 16px mobile
padding. Dialogs scroll within the viewport; modal headings reserve space for
the close button and use the mobile section-heading scale.

Storefront footer newsletter uses brand gold with ink text and a dark CTA;
keep its labelled email input and double-opt-in feedback intact. The shared
footer owns the Sell on alkemart banner, including mobile layouts.

1. **Workers URL required** for production builds (`VITE_ALKEMART_API_URL`).  
2. **Gold brand** `#FEBF31` — no sludge/OSS shell swaps.  
3. **TanStack Query** for server state; no inventing commerce rows in the client.  
4. **Empty / error honesty** — features not on Workers show unavailable, not fake success.  
5. **Nav = capability** — hide routes the API cannot serve.  
6. **Accessible forms** — labels, errors, focus; language control where present.  
7. **Verify in browser** — UI changes need click-path verification (manual against Pages using `NAV-MATRIX.md`; automation optional later), not screenshot-only.

## Definition of done (feature)

- [ ] API route + domain rule + DB effect documented in the matching lifecycle doc  
- [ ] Unit/integration test for money/stock transitions  
- [ ] ACID script scenario or explicit deferral note  
- [ ] UI nav/click covered if user-visible  
- [ ] No new Medusa / Mercur imports  
