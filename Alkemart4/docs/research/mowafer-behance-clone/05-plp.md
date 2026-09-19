# 05 — Category listing / PLP

**Boards:** `boards/web-plp.png`, electronics variant in `boards/web-guidelines.png` (misnamed download; content is electronics PLP), archive `60-mowafer-browse.png`.

---

## Page skeleton

```
HEADER + CATEGORY ICON RAIL
Breadcrumb: Home / {Department}
Hero: “Get All … From One Place!” + lifestyle photo
Filter strip (white card):
  Category radios · Average Rating · Price range · Grid|List
Body:
  LEFT  Categories panel (department accent fill) + Brands panel (dark gray)
  MAIN  Featured large card(s) optional + dense product grid
  View More pill
FOOTER
```

---

## Hero

| Spec | Detail |
|------|--------|
| Headline | Category promise (“Get All Pet Care Needs From One Place!”) |
| Art | Lifestyle photo, department-specific |
| Height | Substantial but not half-viewport waste — art supports title |
| Mobile | Stack: title then image, reduced height |

---

## Filter strip

Horizontal white card under hero:

| Control | Interaction | Data rule |
|---------|-------------|-----------|
| Category | Radio / single-select subcats | From taxonomy |
| Average Rating | Star threshold rows | Only if ratings exist — never fake |
| Price | Dual-handle range | Min/max from catalogue |
| Grid \| List | Icon toggle | View mode only |

---

## Side panels

| Panel | Style | Interaction |
|-------|--------|-------------|
| Categories | **Accent fill** matching department (magenta pet, yellow food, teal electronics) | Single-select feel |
| Brands / Sellers | Dark gray `#5A5A5A`-ish | Multi-select checkboxes |

**This is the Mowafer signature:** filters are chromatic and brand-dark, not slate Amazon drawers.

Alkemart: map accent from department theme tokens. If seller filter replaces brand filter, keep the dark panel treatment.

---

## Product grid

Same card atom as home:

- Image
- Title (2 lines max)
- Star rating + count when earned
- Price
- Yellow add-to-cart control

Optional floating / featured large card for merchandising highlight — only when a real featured rule exists.

---

## shadcn / Radix mapping

| Piece | Component |
|-------|-----------|
| Breadcrumb | `Breadcrumbs` |
| Radios | `RadioGroup` (add if missing) or accessible button group |
| Rating filter | custom with `Button` / checkbox rows |
| Price range | `Slider` (add Radix slider) |
| Brand checks | `Checkbox` |
| Grid/list | icon `Button`s |
| Layout shell | CSS grid: `aside` + `main` |

---

## Acceptance

- [ ] Breadcrumb `Home / Department` above hero
- [ ] Filter strip + left panels both present on desktop
- [ ] Category panel uses department accent colour
- [ ] Brands/sellers panel is dark, not light gray
- [ ] No fabricated ratings or prices
- [ ] View More pill; no progress-bar pagination
- [ ] Mobile collapses side panels into sheet / drawer (`Sheet`)
