# Mowafer Behance → Alkemart clone pack

**Status:** APPROVED 2026-09-19. Spec review complete; next artifact is the implementation plan.  
**Decision locked:** document atomically first, then rebuild a separate foundational storefront. Do not keep patching the buggy current storefront as the clone surface.  
**Stack target:** Vite + React + Tailwind + **shadcn/ui (New York)** + **Radix primitives** (already in monorepo via `@workspace/ui` and `apps/storefront/components.json`).

---

## Sources of truth

| Source | URL / path | Role |
|--------|------------|------|
| Web gallery | https://www.behance.net/gallery/95230309/MOWAFER-E-Commerce-UIUX-Design | Homepage, PLP, cart/checkout boards |
| App gallery | https://www.behance.net/gallery/95225945/MOWAFER-E-Commerce-App-UIUX-Design | IA, journey, mobile screens, checkout, guidelines |
| Designer | Mahmoud Elbeltagy (Cairo), published 2020-04-12 | Author |
| Local board cache | `docs/research/mowafer-behance-clone/boards/` | Downloaded 1400w modules for offline reading |
| Prior archive (stale but useful) | `archive/docs-medusa-era/architecture/2026-07-19-mowafer-*.md` | Earlier deep reads — superseded by this pack where they conflict |

**Product brief (Behance):** price comparison + e-commerce platform (Egypt) — best online and offline grocery/electronics prices to the doorstep.

---

## What “clone” means here

Faithful **structure, hierarchy, and interaction language** of Mowafer, rebuilt in Alkemart chrome:

| Keep from Mowafer | Adapt for Alkemart | Explicit non-goals (v1 rebuild) |
|-------------------|--------------------|----------------------------------|
| Section order on home | Brand wordmark `alkemart.`, gold accent | External Jumia/Souq/Noon scrapers |
| Category mosaic + icon rail | Ghana departments / API names | Loyalty points slider |
| Colored department filter panels | Alkemart department theme map | Full Arabic dual-script |
| Card anatomy + yellow add control | Multi-**seller** offers, not multi-retailer scrape | Articles / magazine branch |
| Stepped checkout machine | Paystack + COD as available | Wishlist / compare list |
| Mobile bottom-tab shell patterns | Phone-first responsive web | Pixel-identical illustration packs |

---

## Atomic file map

| File | Covers |
|------|--------|
| [01-product-thesis-and-ia.md](./01-product-thesis-and-ia.md) | Product thesis, 4-level IA, journeys |
| [02-design-tokens-and-primitives.md](./02-design-tokens-and-primitives.md) | Color, type, radius, icons → CSS tokens |
| [03-global-chrome.md](./03-global-chrome.md) | Header, category rail, footer |
| [04-home.md](./04-home.md) | Mosaic → Last Offers → delivery → advertise |
| [05-plp.md](./05-plp.md) | Hero, filter strip, colored side panels, grid |
| [06-pdp.md](./06-pdp.md) | Gallery, buy, Other Prices → peer sellers |
| [07-cart-checkout.md](./07-cart-checkout.md) | Cart table + address → delivery → payment → done |
| [08-mobile-shell.md](./08-mobile-shell.md) | App chrome, tabs, deals, account |
| [09-shadcn-radix-mapping.md](./09-shadcn-radix-mapping.md) | Every UI atom → shadcn/Radix component |
| [10-alkemart-adaptations.md](./10-alkemart-adaptations.md) | Ghana mapping, deferrals, rebuild order |

Boards live in [`boards/`](./boards/).

---

## Rebuild gate (after this pack is approved)

1. Scaffold a **separate** foundational storefront at `apps/storefront-mowafer` (shares `@workspace/ui`, shared packages, API client). Production `apps/storefront` stays untouched until cutover.
2. Implement **in this order:** tokens → chrome → home → PLP → PDP → cart/checkout → mobile shell.
3. Each section must pass its acceptance checklist in the matching file before the next section starts.
4. Cutover = swap deploy target / route traffic only after phase 6 acceptance; do not mix “fix while cloning” inside the live app.

---

## Review checklist for this pack

- [ ] Sources and clone definition accepted
- [ ] Tokens match Behance guidelines board (yellow `#FEBF31`, dark `#3C3C3B`, category accents)
- [ ] Home / PLP / PDP / checkout section orders match boards
- [ ] Multi-seller adaptation (not scrape) accepted
- [ ] Non-goals (points, articles, wishlist) accepted for v1
- [ ] Rebuild gate accepted
