# 10 — Alkemart adaptations and rebuild order

---

## Concept mapping

| Mowafer | Alkemart native | v1 action |
|---------|-----------------|-----------|
| Multi-retailer Other Prices | Multi-seller peer offers | **Build** on PDP |
| Last Offers | Featured / Deals merchandising | **Build** via home course |
| Category mosaic + icon rail | Departments API + art | **Build** |
| Colored PLP side panels | Department theme tokens | **Build** |
| COD + cards | COD + Paystack | **Build** stepped UX |
| Delivery method / slots | Shipping options / ETA band | Method **yes**; slots **defer** if no data |
| Advertise With Us | Sell on Alkemart | **Build** band |
| Loyalty points | None | **Defer** |
| Wishlist / Compare | None | **Defer** |
| Articles | None | **Defer** |
| AR / Cairo bilingual | Montserrat only | **Defer** AR |
| External price scrape | Non-goal | **Never** |

---

## Brand overlays (do not lose)

These Alkemart decisions override Mowafer cosmetics where they conflict:

1. Wordmark / identity is **alkemart.**, not Mowafer logo.
2. Gold shouts in the capsule (Search / Add / earned badge) — not lemon surface washes.
3. Honesty: no invented % off, stock meters, or fake catalogue fill.
4. Plot beats from market course stay locked; Studio campaigns append after.
5. Phone-first; Ghana traffic is mobile-primary.

---

## Why a separate foundational rebuild

Documented failure mode of the current storefront:

- UX audits show P0 trust/layout defects while merchandising engine is ahead of surfaces.
- Spine and live header have drifted (Hubtel-influenced nav vs older Mowafer-only chrome).
- Patching toward a clone inside a buggy surface mixes regression firefighting with greenfield layout work.

**Rebuild stance:** new foundational storefront app/package implementing this pack section-by-section; share `@workspace/ui`, `@alkemart/shared`, API client, domain. Cut over when acceptance checklists pass.

---

## Rebuild order (strict)

| Phase | Deliverable | Exit criteria |
|-------|-------------|----------------|
| 0 | Scaffold separate app + tokens from `02` | Typecheck green; primary/dept tokens visible |
| 1 | Global chrome `03` | Header + rail + footer match acceptance |
| 2 | Home `04` | S1–S4 order; View More; no chip-tab regression |
| 3 | PLP `05` | Accent side panel + filter strip + sheet on mobile |
| 4 | PDP `06` | Peer offers wired to real offers API |
| 5 | Cart + checkout `07` | Stepper machine; COD/Paystack |
| 6 | Mobile shell polish `08` | Bottom tabs + sticky buy + toasts |
| 7 | Cutover | Redirect / replace production storefront |

Do not start phase N+1 until phase N acceptance boxes are checked in the matching file.

---

## Data honesty gates

| UI element | Allowed only if |
|------------|-----------------|
| Star rating | `ratingCount > 0` |
| Peer offers block | `offerCount > 1` |
| Delivery band minutes | Seller/system band exists |
| Compare-at / % off | Real `compareAt` (else retitle deals) |
| Brand filter | Brand field exists on catalogue |

Empty states explain the missing rule — never backfill with unrelated catalogue.

---

## Relationship to older docs

| Older doc | Status vs this pack |
|-----------|---------------------|
| `archive/.../2026-07-19-mowafer-*.md` | Historical; superseded on conflicts |
| `plans/storefront-ui-ux-audit.md` | Keep for P0 bug inventory on **current** app; not the clone blueprint |
| `plans/ux-overhaul-marketplace-surfaces.md` | Hubtel-weighted; Mowafer structure wins for rebuild IA |
| `apps/storefront/src/design/SPINE.md` | Regenerate from this pack after rebuild lands |

---

## Acceptance for this adaptations file

- [ ] Multi-seller (not scrape) agreed
- [ ] Deferrals (points, wishlist, articles, AR) agreed
- [ ] Separate foundational rebuild + phase order agreed
- [ ] Honesty gates agreed
