# UI foundation — vendor, admin, storefront

**Status:** Canonical design doctrine. Applies to all three apps.
**Why:** e-commerce UI is read, not watched. Our sellers are brand-conscious
businesspeople on low-end phones with metered data. Every decorative pixel
costs them money; every ambiguous control costs them sales. Marketing first,
decoration never.

## 1. Radius scale (no overroundedness)

| Use | Class | Notes |
|---|---|---|
| Surfaces (cards, sheets, modals, inputs, buttons) | `rounded-lg` max | 12px. Nothing rounder, anywhere. |
| Chips, badges, thumbs | `rounded-md` | 8px via `Badge`/`badgeVariants`. |
| Pills, dots, avatars, icon buttons | `rounded-full` | Labels and markers only. |

`rounded-xl/2xl/3xl` are banned in app code (the sweep removed ~400 uses).
`Badge` pins 12px labels; sub-12px text is banned except nav-rail icon
captions (functional micro-labels, documented exception).

## 2. Motion ban

No pulse, shimmer, transitions, entrance animations, hover lifts, or shadow
choreography in app code. Allowed motion, exhaustively:
- Loading spinners (`animate-spin`) — functional feedback, not decoration.
- Skeletons are STATIC geometry mirrors (same boxes as loaded content).
- Hovers change color/border instantly — no `transition-*`, no duration.

Sweep removed `transition-*`, `duration-*`, `animate-in/fade/slide/zoom`,
`hover:shadow-*`, `hover:scale/*` across vendor/admin/storefront/packages-ui.
Skeletons (`Skeleton`, `Shimmer`, `merch-shimmer`) are still blocks.
`prefers-reduced-motion` CSS stays as belt-and-braces.

## 3. Type scale (canonical)

| Role | Class |
|---|---|
| Page title | `text-2xl sm:text-3xl font-black tracking-tight` (`PageHeader`) |
| Section title | `text-lg font-bold tracking-tight` |
| Card title | `text-base font-bold tracking-tight` |
| KPI figure | `text-xl sm:text-2xl font-black tabular-nums leading-tight break-words` — never clips (GH₵2,250.00 overflow fix) |
| Kickers/labels | `text-xs font-bold uppercase tracking-wider`, floor 12px |
| Body/meta | `text-sm` / `text-xs text-muted-foreground tabular-nums` for figures |

## 4. Tone system (no raw hues)

All status color goes through `tone-*` (`Badge tone emphasis`, `Notice tone`)
or `bg-current` dots that inherit the ink. Raw `emerald/rose/green/red/amber`
classes are banned — they bypass the AA-tested ramp. Money/attention states:
- Sellable/positive: ink numerals, tabular. No green pills.
- Out/danger: `text-tone-danger-ink` text, or `danger` solid Badge when it must shout.
- Live/published markers: `bg-ink text-white` chip (editorial) or brand gold for review states.
- Dots only where live-ness is the message, inheriting ink (`bg-current`).

## 5. Notices (one banner primitive)

`Notice` (`@workspace/ui`): fixed structure (icon + 14px bold title + 13px
body + optional action), tone ramp, `rounded-lg`, correct `role` (alert for
danger, status otherwise). All login errors, setup calls-to-action, and
banners use it — no bespoke alert divs. Dashboard standing/task rows stay as
navigating list rows (they route somewhere; notices don't).

## 6. Skeletons mirror layout

Every loading state renders the loaded layout's geometry (KPI row → 4 blocks,
chart → axis + 7 bar silhouettes, table → rows). Never a generic spinner page,
never shimmer. `SalesBars loading` shows fixed-height silhouettes; empty (not
loading, no data) shows the honest empty message. Loading and empty are
different states and must never share a visual.

## 7. Commerce patterns (vendor)

- **Own-category shelves:** seller's categories as underline text-tabs
  (selected = ink border), never pills. Narrows grid + table for per-shelf
  publish/stock decisions. Hidden under 2 shelves.
- **Quick actions ride variant PATCH** (documented no-re-review): stock
  stepper (− qty +) and Live/Offline text toggle, inline on cards. Hidden
  when card data lacks variant/stock — never guessed.
- **Cards are quiet:** photo, status chip, title, price, stock-as-number,
  actions. Category in nav/filters/table; refs in table/detail; live-view on
  detail. Nothing machine-stamped, nothing twice.
- **Tables are dense data UI:** refs, categories, icon actions belong here.

## 8. Chart doctrine (accessible charts)

Bars, one metric at a time, never dual-axis lines. Static SVG (~2KB, no
dependency): best bar in brand gold with direct value label, tabular axis,
weekday slots, `role="img"` summary + sr-only data table, Accra-day buckets
from the seller's own orders. Toggle Revenue|Orders by tap. Empty shows the
honest message, never fake bars. Deltas render only with previous-period
data — otherwise the line is absent, not zero.

## 9. Guards (regression-proof)

- `hooks-order.test.ts` (storefront): static scan fails on hooks after
  conditional returns (React #310 class). Negative-controlled.
- `tone-ramp.test.ts`: AA contrast floor on the ramp.
- `check-migrations.ts`: journal + idempotency (data side, same spirit).
- tsc on all apps; suites: api 219+, domain 86, storefront 161.

## 10. Non-goals

Dark-mode redesign (tokens carry it where it exists), marketing-site art
direction (storefront marketing surfaces keep their editorial voice within
these rules), custom fonts beyond Montserrat, animation of any kind.
