# Icon asset list (for designers / you)

Drop SVGs into:

```
apps/storefront/public/icons/mowafer/{icon-id}.svg
```

Also sync to live worktree if used:

```
/home/amber/alkemart-storefront/public/icons/mowafer/
```

Until files exist, the app uses **built-in outline fallbacks** so layout stays stable.

## Spec

| Rule | Value |
|------|--------|
| Format | SVG (preferred) or PNG @2x |
| ViewBox | `0 0 24 24` |
| Style | Outline / monoline, ~1.75 stroke (Mowafer style) |
| Color | `currentColor` (single-color; we tint via CSS) |
| Padding | ~2px safe inset |
| Naming | Exact id below, lowercase, hyphens |

## Required icons (priority order)

### P0 — Chrome & home (ship first)

| File name | Used for |
|-----------|----------|
| `search.svg` | Header search |
| `cart.svg` | Header cart |
| `user.svg` | Account |
| `globe.svg` | Language (optional if LanguageSelect has own icon) |
| `add-cart.svg` | Product card cart button |
| `cat-electronics.svg` | Category rail |
| `cat-food.svg` | Category rail |
| `cat-beverages.svg` | Category rail |
| `cat-personal-care.svg` | Category rail |
| `cat-pet-care.svg` | Category rail |
| `cat-baby.svg` | Category rail |
| `cat-fashion.svg` | Category rail |
| `cat-home.svg` | Category rail |
| `cat-health.svg` | Category rail |
| `cat-all.svg` | “All” in rail |
| `package.svg` | Delivery band |
| `truck.svg` | Delivery band |
| `world.svg` | Delivery band |

### P1 — Listing / product / checkout

| File name | Used for |
|-----------|----------|
| `star.svg` | Ratings (when data exists) |
| `star-empty.svg` | Ratings empty |
| `star-half.svg` | Ratings half |
| `filter-grid.svg` | Grid view toggle |
| `filter-list.svg` | List view toggle |
| `heart.svg` | Wishlist (later) |
| `chevron-right.svg` | Breadcrumbs / tiles |
| `close.svg` | Sheets / modals |
| `menu.svg` | Mobile drawer |
| `location.svg` | Checkout address |
| `payment.svg` | Checkout payment |
| `check.svg` | Success / stepper |
| `delivery.svg` | Shipping method |
| `secure.svg` | Trust |
| `cod.svg` | Cash on delivery trust |

## Optional category photography (home mosaic)

Mosaic tiles currently use **color + initial letter**. Optional photo backgrounds:

```
public/images/categories/{handle}.jpg
```

e.g. `food-groceries.jpg`, `phones-electronics.jpg` — wire later without changing component API.

## Checklist

- [ ] P0 icons in `public/icons/mowafer/`
- [ ] Open home — rail icons swap from fallbacks automatically
- [ ] No broken-image layout shift (fallbacks stay sized 24×24)

## Source of truth in code

`src/design/icons/types.ts` — `ICON_IDS` array  
`src/design/icons/Icon.tsx` — `IconSafe` loads `/icons/mowafer/{id}.svg`
