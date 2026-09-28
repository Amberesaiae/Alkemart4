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

Storefront v2 reading scale: body text, navigation and form controls are
1rem (16px at default browser settings); secondary details are 0.875rem
(14px). Use rem-based type tokens instead of 10–15px font utilities. Keep
section headings distinct (28px/32px), readable line spacing, and allow
controls to grow with text. Check 375px and desktop layouts plus zoom/reflow;
this sizing policy is not a claim of full WCAG conformance. The approved
mobile homepage is explicitly excluded: its existing type scale and
composition are preserved below 768px via a home-route-only scope.

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
