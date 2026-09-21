# 02 — Design tokens and primitives

**Boards:** `boards/app-guidelines.png` (color + type + icon system).  
**Implementation target:** CSS variables in storefront `@theme` / `:root`, consumed by shadcn tokens (`--primary`, `--foreground`, etc.).

---

## Color (exact from guidelines board)

| Role | Hex | CSS intent |
|------|-----|------------|
| Primary yellow | `#FEBF31` | `--primary` / CTA fill, logo tile, cart buttons, active accents |
| Primary dark | `#3C3C3B` | `--foreground` / body ink, dark chrome |
| Electronics | `#50D1C8` | `--dept-electronics` |
| Food | `#FEBF31` | `--dept-food` (same as primary) |
| Home & Pet | `#F0295A` | `--dept-home-pet` |
| Beverages | `#9AC63B` | `--dept-beverages` |
| Health | `#3C3C3B` | `--dept-health` |
| Baby | `#F5F5F5` | `--dept-baby` (soft surface; ink stays dark on it) |

### Alkemart token discipline (must not fight Mowafer structure)

Existing Alkemart rules still apply on top of the Mowafer shape:

- Gold/yellow is **accent and CTA**, never a page wash (`bg-primary/N` banned).
- Paper stays near-white; department **art and filter panels** carry colour worlds.
- Map Mowafer `#FEBF31` → Alkemart spark/primary (`#FFC400` / `#FEBF31` family). Prefer one canonical primary in CSS; do not ship both as competing brand fills.

---

## Typography

| Script | Family | Usage |
|--------|--------|-------|
| Latin | **Montserrat** | All UI (storefront already loads Montserrat) |
| Arabic | **Cairo** | Deferred for v1 rebuild (keep font hook; no AR copy requirement) |

Type roles (rebuild spine):

| Role | Approx | Use |
|------|--------|-----|
| Display / section | Montserrat 700, large | PLP hero, home section titles |
| Title | 600–700 | Product titles, card titles |
| Body | 400–500 | Descriptions, filter labels |
| Meta | 400, smaller | Ratings, breadcrumbs, captions |
| Floor | ≥ 14px on interactive UI | Touch and readability |

---

## Shape language

| Element | Recipe |
|---------|--------|
| Cards | Soft white, radius ~12–16px, light border/shadow |
| Primary button | Pill / high radius, yellow fill, dark label |
| Icon rail tiles | Circular or soft-square line icons |
| Category mosaic | Large rounded tiles, photo or flat colour field + label |
| Filter side panels | Strong department fill (not gray Amazon drawers) |
| Inputs | Rounded rectangle, quiet border, yellow focus ring |

---

## Icon system (from board)

Line icons for: Electronics · Food · Beverages · Home & Pet · Health · Baby.

**Alkemart:** keep Phosphor (already in `@workspace/ui`) or existing `icons/mowafer` pack; one icon set only. Labels always from API category names, never hardcoded English from the board.

---

## Primitive inventory (atoms)

| Atom | Visual job |
|------|------------|
| Logo mark | Yellow square + wordmark |
| Search field | Wide, placeholder price-framing |
| Product card | Image · title · stars · price · yellow cart control |
| Section header | Title left · optional controls right |
| View More | Centered soft pill (not progress bar) |
| Breadcrumb | `Home / Department` |
| Stepper | Icon + label for checkout stages |
| Toast | “1 Item Added To Cart” |

---

## Acceptance

- [ ] One primary yellow token; no cream/gold surface washes
- [ ] Department accent tokens exist for filter panels / mosaic
- [ ] Montserrat wired; Cairo optional stub only
- [ ] Card radius and pill CTAs match the soft Mowafer language, not hard rectangles
