# 08 — Mobile shell and app patterns

**Boards:** `boards/app-screens.png`, `boards/app-checkout.png`, `boards/app-cover.png`.

Rebuild target is **responsive web** that absorbs app patterns — not a native binary.

---

## Shell

| Region | Spec |
|--------|------|
| Top bar | Yellow / brand chrome · logo · cart · search field |
| Bottom tabs | Home · Best Offers / Deals · Search · Account |
| Toasts | e.g. “1 Item Added To Cart” |

Tab count stays ≤ 5. Do not add a sixth competing destination.

---

## Screen catalog (must have responsive equivalents)

| Screen | Key elements |
|--------|--------------|
| Splash / entry | Brand mark, short promise (optional first-run) |
| Home | Category icon grid, Deals Of The Day, Top Selling |
| Deals | Full deals grid + category chips |
| Account | Orders, settings entry, sign out |
| PDP | Gallery, price, qty, tabs, Other sellers, Add |
| Cart | Lines, fees, Place Order |
| Checkout steps | Address → delivery/slots → payment → done |

---

## Interaction differences vs desktop

| Pattern | Mobile rule |
|---------|-------------|
| PLP filters | Side panels → `Sheet` / bottom drawer |
| Buy CTA | Sticky bottom bar on PDP |
| Nav | Bottom tabs replace dense header links |
| Search | Dedicated tab or full-width field under top bar |
| Grid density | 2 columns default for product grids |

---

## shadcn / Radix mapping

| Piece | Component |
|-------|-----------|
| Bottom tabs | custom nav with links; consider `Tabs` only if stateful |
| Filter drawer | `Sheet` |
| Toast | `sonner` (already in `@workspace/ui`) |
| Sticky buy bar | fixed region + `Button` |

---

## Acceptance

- [ ] ≤768px: bottom tab bar present and usable
- [ ] PLP filters open in sheet, not crushed sidebar
- [ ] PDP sticky buy bar does not cover critical content without scroll
- [ ] Add-to-cart feedback visible as toast
- [ ] Checkout remains stepped, single column
