# Mowafer UI folder — deep analysis (all boards)

**Sources**

| Pack | Files | Role |
|------|-------|------|
| `ui/E-Commerce Platform _ Mowafer __ Behance/` | imgi_10–13 (+ 51–54 dupes) | **Web** homepage, PLP, cart/checkout |
| `ui/MOWAFER E-Commerce App UI_UX Design __ Behance/` | imgi_9/50 IA, 10/51 journey, 12/53 mobile screens, 14/55–56 checkout | **Mobile** IA + app screens |

---

## 1. Homepage skeleton (imgi_10) — vertical hierarchy

```
┌─────────────────────────────────────────────┐
│ HEADER  logo · search · nav · account·cart  │
├─────────────────────────────────────────────┤
│ CATEGORY RAIL  6 icon+label (line icons)    │  quiet chrome
├─────────────────────────────────────────────┤
│ MOSAIC  2 tall + 2 stacked color tiles      │  first “wow”
│   Pets | Food | Cosmetics / Electronics     │
├─────────────────────────────────────────────┤
│ LAST OFFERS                                 │
│   h2 left                                   │
│   [icon tabs ‑‑‑‑‑‑‑‑‑]  [sort] [grid|list] │  ← NOT yellow text chips
│   mixed product grid                        │
│   centered pill “View More”                 │  ← only pagination on home
├─────────────────────────────────────────────┤
│ DELIVERY band  copy + art                   │
├─────────────────────────────────────────────┤
│ ADVERTISE band  yellow form                 │
├─────────────────────────────────────────────┤
│ FOOTER  brand · Categories · Quick links    │
└─────────────────────────────────────────────┘
```

### Last Offers tabs (critical)

Mowafer uses **icon-only** filter controls under the title:

- Small **square/rounded icon buttons** in a horizontal strip  
- Outline / quiet gray when idle; **subtle active** (not big yellow pills with words)  
- Categories: Electronics · Food · Beverages · Personal Care · Pet · Baby  
- **Right cluster:** sort caption (“What is Need? / Hot First”) + **grid/list** toggle  

**Wrong (current):** yellow filled chips with icon+label text.  
**Right:** icon squares + separate sort + view mode.

### Pagination (home + PLP)

- **No** “Showing 12 of 48” progress bar  
- **No** “Load more” rectangular outline button  
- **Yes:** single centered soft pill **View More** (white, border, rounded-full)

---

## 2. PLP skeleton (imgi_11 / imgi_12)

```
HEADER + CATEGORY RAIL
Breadcrumb: Home / {Department}
Hero: “Get All … From One Place!” + lifestyle photo
Filter strip (white card):
  · Category radios (subcats)
  · Average Rating (star rows)
  · Price (range + yellow handles)
  · Grid | List icons
Sidebar:
  · Categories panel (color = department accent) radio list
  · Brands panel (dark gray) radio/checkbox list
Main:
  · Featured large card(s) + dense product grid
  · View More pill
FOOTER
```

### Breadcrumbs

- Path style: `Home / Department` (muted Home, current in foreground)  
- Compact, above title/hero — not buried  

### Filters (well-baked pattern)

| Panel | Style | Interaction |
|-------|--------|-------------|
| Categories | Accent fill (magenta/yellow/teal) | Single-select radio feel |
| Brands / Sellers | Dark gray `#5A5A5A` | Multi-select checkboxes |
| Rating | Star rows in filter strip | Optional single min rating |
| Price | Min–max dual control | Range |
| View | Grid / list icon pair | Toggle |

---

## 3. Cart + checkout (imgi_13)

```
Breadcrumb: Shopping Cart › Delivery and Payment
Cart table: product · price · qty · subtotal · color rail per line
Checkout stepper: Address (pin) → Delivery (rocket) → Payment (card)
Payment: COD default + card options
Success: check circle + Track Your Order
```

---

## 4. Mobile app (imgi_12 pack) — reinforcement

- Yellow header + search  
- Category icon row (colored squares)  
- Deals Of The Day grid  
- Bottom nav: Home · Best Offers · Search · Account  
- PDP: multi-retailer **Other Prices** list (Jumia / Souq / Noon)  

Maps to alkemart: multi-**seller** peer offers on PDP.

---

## 5. Alkemart implementation targets

| Component | Target |
|-----------|--------|
| `LastOffersTabs` | Icon-only tabs + sort + grid/list |
| `HomeLastOffers` | View More pill only |
| `LoadMore` / ViewMore | Mowafer pill; kill progress bar |
| `Breadcrumbs` | Shared `Home / …` atom |
| `ListingLayout` | Breadcrumb + filter strip + sidebar grid |
| `ListingFilters` | Color categories + gray sellers + sort + price |

---

## 6. Non-goals (user decisions already made)

- Header text nav (Home / Last Offers / Help) — omitted  
- Language switcher — omitted  
- Logo is **text** `alkemart.` only  
