# Product card map — Mowafer imgi_10

Source board: `ui/imgi_10_f14deb69721237.5b93138a5c0dd.png` · Last Offers section.

## Layouts (canonical `ProductCard` `size`)

| size | Orientation | Anatomy | Used in |
|------|-------------|---------|---------|
| **hero** | Vertical | Media top · category · title · description · stars · price + **Add To Cart** pill | Home col-1 top |
| **feature** | Landscape | Media left (~42%) · category · title · desc · stars · price + **Add To Cart** pill | Home col-2 top |
| **row** | Landscape | Media left · category · title · stars · price + heart + cart **icon** | Mid band · list view |
| **tile** | Vertical compact | Media top · category · title · price + heart + cart **icon** | Side pair · dense 5 · dense 4 · PLP |

Aliases: `sm` / `md` / density compact → **tile**.

## Supporting atoms

| Component | Role |
|-----------|------|
| `ProductCategoryLabel` | Tiny muted line above title (“Televisions”) |
| `ProductRating` | Yellow star row (0–5, half support) |
| `WishlistHeart` | Outline heart toggle (local until wishlist API) |
| `AddToCartControl` | `pill` vs `icon` (yellow circle) |
| `Price` | API amount only |
| `SellerChip` | Multivendor “Sold by …” when present |

## Home hierarchy (`HomeLastOffers`)

```
[ hero 5/12 ] [ feature landscape  ]
              [ tile ] [ tile ]
[ row horizontal ] [ row horizontal ]
[ tile × 5 ]
[ tile × 4 ]
        [ View More ]
```

## Non-goals

- Invented prices / sellers / ratings on live API products without data  
- Progress-bar pagination (View More pill only)  
- Yellow text chip category filters (icon tabs only)
