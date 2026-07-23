# ICONPAK2 → storefront mapping

Source: `ICONPAK2/` (black monoline on transparent + cart asset).  
**Re-ID’d from visual sheet 2026-07-19** (previous table had several swaps).

| File | Content | Semantic id |
|------|---------|-------------|
| 49 | dual bottles | `cat-personal-care`, `cat-health` |
| 50 | tank top | fashion spare |
| 51 | baby bottle | `cat-baby` |
| 52 | open book | `cat-all` / `filter-grid` |
| 53 | camera | product spare |
| 54 | armchair | `cat-home` |
| 55 | power drill | tools spare |
| 56 | CRT TV | `cat-electronics-tv` |
| 57 | dress | fashion spare |
| 58 | t-shirt | `cat-fashion` |
| 59 | gamepad | gaming spare (not pet) |
| 60 | spoon + spatula | **`cat-food`**, `cat-food-kitchen` |
| 61 | laptop | **`cat-electronics`** |
| 62 | jar / bottle | **`cat-beverages`** |
| 63 | video camera | media spare |
| 64 | tape measure | spare |
| 65 | smartphone | `cat-electronics-phone` |
| 66 | soccer ball | spare |
| 67 | eraser | spare |
| 68 | plate / disc | spare |
| **462** | **shopping cart** | **`cart`**, **`add-cart`** |

## Chrome commerce icons

| Semantic id | Asset | Used by |
|-------------|-------|---------|
| `cart` | `public/icons/mowafer/cart.webp` | Header Cart, chrome |
| `add-cart` | `public/icons/mowafer/add-cart.webp` | Product card CTA, Add To Cart pill |

Source: `ICONPAK2/imgi_462_cart-icon-svg-download-png-2471581.png` → 512² WebP (q95).

## Gaps

- **No pet/animal glyph in ICONPAK2.** Storefront uses monoline paw SVG: `public/icons/mowafer/cat-pet-care.svg`.
- **No true star glyph** — `ProductRating` uses stroke SVG fallbacks (`preferAsset={false}`).

## Mosaic (imgi_10)

| Tile | Title (single line) | Art |
|------|---------------------|-----|
| Pets | Pets Care Category | photo `/images/categories/pets.webp` |
| Food | Food Category | photo `/images/categories/food.webp` |
| Cosmetics | Cosmetics Category | photo `/images/categories/cosmetics.webp` |
| Electronics | Electronics Category | photo `/images/categories/electronics.webp` |
