# 09 — shadcn / Radix mapping

**Context:** Storefront already uses shadcn New York (`apps/storefront/components.json`). Shared primitives live in `@workspace/ui` with Radix checkbox, dialog, dropdown, popover, select, separator, switch, tabs, avatar, slot.

This file is the build contract: **do not invent bespoke interactive widgets when a Radix/shadcn primitive exists.**

---

## Already available (reuse)

| Need | Existing |
|------|----------|
| Button / CTA | `Button` |
| Input / textarea / label | `Input` `Textarea` `Label` |
| Card | `Card` |
| Tabs | `Tabs` |
| Checkbox | `Checkbox` |
| Select | `Select` |
| Dropdown | `DropdownMenu` |
| Dialog / modal | `Dialog` / `modal` |
| Table | `Table` |
| Skeleton | `Skeleton` |
| Separator | `Separator` |
| Switch | `Switch` |
| Toast | `sonner` |
| Avatar | `Avatar` |
| Breadcrumbs | `Breadcrumbs` |
| Badge | `Badge` |
| Store card | `store-card` |
| Merchandising atoms | `merchandising` |

---

## Gaps to add before/during rebuild

| Mowafer need | Add via shadcn/Radix |
|--------------|----------------------|
| Price range dual handle | `@radix-ui/react-slider` → `Slider` |
| Single-select filter radios | `@radix-ui/react-radio-group` → `RadioGroup` |
| Grid/list toggle | `ToggleGroup` (`@radix-ui/react-toggle-group`) |
| Mobile filter drawer | `Sheet` (`@radix-ui/react-dialog` sheet pattern) |
| Accordion (FAQ later) | `Accordion` (defer) |
| Scroll area for rails | `ScrollArea` (optional) |
| Progress (avoid on home) | Do **not** use for View More |

---

## Composition recipes

### Product card

```
Card
  image region (link)
  title (link)
  seller (link, accent)
  Price
  rating meta
  Button (icon or pill) → add to cart
```

### PLP filter strip

```
Card (horizontal)
  RadioGroup (subcats) | rating buttons | Slider (price) | ToggleGroup (view)
```

### PLP side panels

```
aside
  Card (bg-dept-accent) → RadioGroup categories
  Card (bg-neutral-dark text-white) → Checkbox brands/sellers
```

### Checkout stepper

```
ol[aria-label=Checkout steps]
  li × 4 with icon + label; yellow for current
forms use Input/Label/Select/RadioGroup/Button
```

### Mobile bottom nav

Plain semantic `<nav>` + links; not a Radix Tabs hijack of routing.

---

## Styling rules under shadcn

1. Map Mowafer yellow to `--primary`; dark ink to `--foreground`.
2. Department accents are **extra CSS variables**, not random Tailwind hex in JSX.
3. Prefer `variant` / `size` on `Button` over one-off class piles.
4. Yellow CTAs: short verbs (Add, Search, Shop, Confirm) — stamp/capsule language already chosen for Alkemart.
5. Do not restyle Radix focus rings away; keep accessible `:focus-visible`.

---

## Acceptance

- [ ] Interactive filters use Radix-backed components
- [ ] No custom modal/dropdown that reimplements focus trap
- [ ] Slider + RadioGroup + Sheet added when PLP rebuild starts
- [ ] Product card and shop card remain single shared atoms
