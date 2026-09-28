---
name: alkemart-ui-ux
description: UI/UX rules for alkemart's storefront-v2, vendor-v2 and admin-v2 — use before building or changing any screen, form, flow or copy in these apps.
---

# alkemart UI/UX rules

These came from the owner's direct feedback. Breaking them gets the work redone.

## Layout and interaction

- **No pop-ups for flows.** Confirmations, "mark delivered", reporting a problem,
  custom date ranges, search results: render **inline** (expand in place, push
  content down). Existing dialogs are legacy; don't add new ones.
- **Steppers and tabs, never long lists.** First-run setup is a stepper
  (`vendor-v2/src/routes/setup.tsx`, one decision per screen, saves as you go,
  resumable, skippable except what's required). Settings pages are tabs
  (`routes/_app/shop.tsx`). Reuse the same section components for both via
  `FlowContext` (`vendor-v2/src/components/shop/shared.ts`).
- **No native date/time inputs.** Use the kit's `DateTimePicker`, `DatePicker`,
  `TimeSelect` (`@workspace/console-ui/components/console/date-time-picker`).
- **No visible scrollbars at rest.** Use the `scroll-quiet` utility (console-ui
  globals). Horizontal chip rows: `scroll-quiet` + scroll the active chip into
  view (see `console-ui/src/components/console/range-picker.tsx`).
- **Locations are map pins**, not region dropdowns: `@alkemart/maps`
  `LocationPicker` (search, "use my location", centre pin, reverse lookup
  fills town/area/region). Used for sellers and buyers.
- One tap for the common path. Anything optional says "(optional)" and never
  blocks (e.g. the handover code).

## Phone-first checks (every screen)

- 375px wide: `document.documentElement.scrollWidth === innerWidth` (no sideways scroll).
- Big numbers wrap instead of spilling out (`[overflow-wrap:anywhere]`, smaller text below `sm`).
- Tap targets ≥ 40px for buttons, ≥ 24px for inline links.
- Sticky bottom actions sit above the tab bar (`bottom-16` on vendor).

## Accessibility

- Exactly one `h1`; no skipped heading levels (use an `sr-only` h2 if needed).
- Every field has a `<label htmlFor>`; every icon button has an `aria-label`.
- Custom radios: `role="radio"` + `aria-checked`, inside `role="radiogroup"` with a label.
- Live results and statuses: `aria-live="polite"` / `role="status"`.
- Never put a link inside a radio/option; put it next to it.

## Copy (plain language, the buyer's or seller's words)

- Say what happens next and who does it: "Payment is released Oct 3 unless the buyer reports a problem."
- Errors say how to fix it: "Enter a fee like 30 or 30.50." Never show raw provider errors.
- Adapt wording to the case: pickup vs delivery ("Collected", "Ready for pickup",
  "Have GH₵… ready when you collect"), pay-on-delivery vs online ("paid straight
  away" is meaningless when the seller already holds the cash).
- Don't show comparisons where they mislead ("all time" vs the empty period before).

## Agnostic display

- Money: `formatMinor` (console-ui) / `formatMoney` (storefront) from minor units.
  Never hard-code 100 minor units or "GH₵"; the market decides.
- Policy numbers (report windows, code tries, same-town km…) are **never written
  into an app**. Show what the API computed (e.g. `payoutReleaseAt`).
- If the API can decide something (e.g. "is this payout still waiting?"), let it.
  That also avoids `Date.now()` in render, which lint rejects.

## Colour tokens differ per app

- console-ui (vendor/admin) has `brand-soft`, `success-soft`, `warning-soft`, `danger-soft`.
- storefront-v2 has `brand`, `success-soft`, `warning`, `deal`, `destructive`, but
  **no** `*-soft` brand/warning/danger. Use `bg-brand/15`, `bg-warning/10`,
  `bg-destructive/10` there.

## Verify before saying done

Walk the real flow in the sandbox (see the `alkemart-sandbox-verify` skill):
screenshot desktop and 375px, check console errors, and read the DOM for the
exact text.
