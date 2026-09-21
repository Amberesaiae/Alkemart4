# 04 — Homepage

**Boards:** `boards/web-home.png`, mobile home strip in `boards/app-screens.png`.

---

## Vertical hierarchy (clone order)

```
HEADER + CATEGORY ICON RAIL
↓
S1  CATEGORY MOSAIC     2 tall + 2 stacked colour/photo tiles
↓
S2  LAST OFFERS         title · icon tabs · sort · grid|list · product grid · View More
↓
S3  DELIVERY BAND       copy + logistics art + Shop Now
↓
S4  ADVERTISE BAND      yellow form (email / phone / subscribe)
↓
FOOTER
```

**Marketing course rule:** mosaic is first theatre. Campaigns never steal the first screen. Alkemart Studio campaigns may append **after** the fixed beats, never before mosaic / featured offers.

---

## S1 — Category mosaic

| Spec | Detail |
|------|--------|
| Layout | Asymmetric bento: two tall tiles + two stacked |
| Content | Department photo or flat accent + label |
| Interaction | Entire tile → category PLP |
| Copy | Short department name only — no paragraph overlays |

Alkemart departments map onto tiles by `MARKET_DEPARTMENT_ORDER` / API names. Broken art falls back to glyph/shimmer — never fake stock photography.

---

## S2 — Last Offers

### Header row

- Left: section title (`Last Offers` / Alkemart equivalent: Featured / Deals)
- Mid: **icon-only** category tabs (square/rounded, quiet outline; subtle active — **not** fat yellow text chips)
- Right: sort caption + **grid | list** toggle

### Grid

- Product cards: image · title · stars · price · **yellow cart** control
- Mixed departments allowed; de-duplicate against other home shelves when Alkemart merchandising engine is wired

### Pagination

- **Only** a centered soft pill **View More**
- No “Showing 12 of 48” progress bar
- No rectangular Load More outline

---

## S3 — Delivery band

Trust / logistics story: copy + illustration + primary CTA (`Shop Now`). Not a form. Keep short for Ghana: delivery expectation language when ETA data exists; otherwise honest logistics copy without invented minutes.

---

## S4 — Advertise / sell band

Yellow full-bleed band with lead capture (email / phone). Alkemart maps this to **Sell on Alkemart** / vendor acquisition — same job, local copy.

---

## Mobile home differences

From app screens:

- Yellow top app bar + search
- Category icon grid (coloured tiles)
- **Deals Of The Day** grid
- **Top Selling Items**
- Bottom tabs: Home · Offers · Search · Account

Web rebuild uses responsive breakpoints to approximate this; native app is out of scope.

---

## shadcn / Radix mapping

| Piece | Component |
|-------|-----------|
| Mosaic tiles | `Card` / custom link tiles |
| Icon tabs | `Tabs` or toggle `Button` group |
| Grid/list | `ToggleGroup` (add if missing) or two icon `Button`s |
| Product grid | CSS grid + shared `ProductCard` |
| View More | `Button` variant outline, `rounded-full` |
| Advertise form | `Input` + `Button` |

---

## Acceptance

- [ ] Section order matches S1→S4; nothing inserted above mosaic
- [ ] Last Offers tabs are icon-first, not yellow word chips
- [ ] View More pill only for home pagination
- [ ] Delivery + advertise bands present (or intentionally collapsed with honest empty)
- [ ] Mobile breakpoint keeps category entry + deals without desktop-only sidebars
