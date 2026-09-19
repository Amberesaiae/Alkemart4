# 03 — Global chrome (header, category rail, footer)

**Boards:** `boards/web-home.png`, `boards/web-plp.png`, `boards/web-cart.png`.

---

## Header anatomy (web)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Yellow logo]  [ Search ........................ 🔍 ]            │
│                Home · Last Offers · About · Contact              │
│                [lang] [account] [cart]                           │
└──────────────────────────────────────────────────────────────────┘
```

| Slot | Mowafer | Alkemart rebuild |
|------|---------|------------------|
| Logo | Yellow tile + wordmark | `BrandLogo` / alkemart. wordmark |
| Search | “Find Your Products with best Price” | Multi-seller framing (“best price” / “compare sellers”) — not Amazon generic |
| Text nav | Home · Last Offers · About · Contact | Keep short: Home · Stores · (optional) Purchases. Drop Help clutter. |
| Lang | EN / عربي | Defer AR; omit control until bilingual ships |
| Account | User icon | Auth entry |
| Cart | Icon + count | Cart route |

**Rule:** Search is the hero control in the header. No second Search button outside the field.

---

## Category icon rail

Sits **under** the header on home and browse surfaces:

```
[icon] Electronics | Food | Beverages | Care | Pet | Baby
```

| Property | Spec |
|----------|------|
| Density | Cap **6** departments (Mowafer density) |
| Style | Line icon + short label; quiet chrome |
| Behavior | Navigates to PLP / category slug |
| Order | Product-owned department order (Alkemart: phones-electronics → fashion → home → health → baby → food last) |

This rail is **taxonomy entry**, not Hubtel-style service verbs. Do not merge with mosaic.

---

## Footer

| Column | Content |
|--------|---------|
| Brand | Logo, short blurb, payment marks |
| Categories | Department links |
| Quick links | About, Contact, Care, legal |
| Legal | Copyright |

Footer is full-bleed ink or near-dark; not a gold wash.

---

## shadcn / Radix mapping

| Chrome piece | Component |
|--------------|-----------|
| Search input | `Input` + icon button (`Button` size icon) |
| Account menu | `DropdownMenu` |
| Cart link | `Button` asChild → link |
| Nav links | plain anchors / `NavigationMenu` only if needed |
| Mobile sheet (later) | `Sheet` / `Dialog` from Radix |

---

## Acceptance

- [ ] Header = logo · search · short nav · account · cart
- [ ] Icon rail max 6, under header, not between shelves
- [ ] Search placeholder frames price/comparison job
- [ ] No language switcher in v1
- [ ] Footer has brand + categories + legal; no duplicate primary CTAs
