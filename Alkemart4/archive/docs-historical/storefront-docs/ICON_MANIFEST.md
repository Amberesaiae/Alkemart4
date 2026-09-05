# Icon asset list — alkemart storefront

## Where assets live

```
apps/storefront/public/icons/mowafer/{icon-id}.png   # primary (iconpack + IconScout)
apps/storefront/public/icons/mowafer/{icon-id}.svg   # optional override
```

`IconSafe` tries **PNG first**, then SVG, then outline fallback.

Live worktree (dev server):

```
/home/amber/alkemart-storefront/public/icons/mowafer/
```

## Source packs

| Pack | Path | Role |
|------|------|------|
| **iconpack** (pixel, 512²) | `iconpack/imgi_47–66_*.png` | Category rail + mosaic watermarks |
| **IconScout ecommerce** | `vectors/Ecommerce Icon Pack - 82…` | Chrome: cart, truck, user… |
| **public/icons/*.png** | pre-converted yellow variants | Fallback chrome |

## iconpack → category map

| File | Glyph | Icon id |
|------|-------|---------|
| `imgi_48` | Laptop | `cat-electronics` |
| `imgi_47` | Fork & spoon | `cat-food` |
| `imgi_49` | Pan & spatula | `cat-beverages` (kitchen/drink proxy) |
| `imgi_50` | Cosmetics tube + jar | `cat-personal-care` |
| `imgi_51` | Basketball + ball | `cat-pet-care` (proxy until paw asset) |
| `imgi_63` | Baby onesie | `cat-baby` |
| `imgi_62` | Dress | `cat-fashion` |
| `imgi_64` | Nightstand + lamp | `cat-home` |
| `imgi_65` | Medicine bottle | `cat-health` |
| `imgi_54` | Desktop PC | `cat-all` |

Extras (product accents): `product-laptop`, `product-phone`, `product-camera`, `product-game`, `product-headphones`, `product-pharmacy`, `product-shirt`, `product-books`.

## Chrome icons (IconScout / public)

| id | Use |
|----|-----|
| `cart` | Header cart |
| `add-cart` | Product card CTA |
| `user` | Account |
| `heart` | Wishlist |
| `truck` / `delivery` | Delivery band |
| `package` | Delivery / orders |
| `location` | Address / delivery |
| `payment` | Checkout |
| `secure` | Trust |
| `cod` | Cash on delivery |
| `world` | Delivery band |

## Mowafer homepage hierarchy (imgi_10)

1. **Header** — logo · search · Home / Last Offers / Help · account · cart  
2. **Category icon rail** — icon + label row (`CategoryIconRail`)  
3. **4-tile mosaic** — asymmetric Pets | Food | Cosmetics / Electronics (`CategoryMosaic`)  
4. **Last Offers** — hero + side cards + dense row + View More  
5. **Delivery band** — copy + floating icons  
6. **Advertise band** — yellow form CTA  
7. **Footer**

## Checklist

- [x] P0 category PNGs from iconpack
- [x] P0 chrome PNGs from IconScout / public
- [x] `IconSafe` PNG → SVG → fallback
- [x] Rail + mosaic wired to icon ids
- [ ] Optional: true paw icon for pet, true bottle for beverages
- [ ] Optional: category photography under `public/images/categories/`

## Code source of truth

- `src/design/icons/types.ts` — `ICON_IDS`, `categoryIconId`
- `src/design/icons/Icon.tsx` — `IconSafe`
- `src/design/tokens.ts` — mosaic accents
