# Alkemart illustration & icon system

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Brand yellow** | `#f5c518` |

## Image analysis (important)

All IconScout assets are **RGBA with transparent corners** — not opaque black plates.

| Pack | Style | Opaque ink | Correct surface |
|------|--------|------------|-----------------|
| **6 illustrations** | Black silhouette + gold accents | Black + `#fec35f` gold | **Light only** (`#faf8f2` / white). On `#141414` the figure vanishes. |
| **25 illustrations** | White fills + black lines + yellow blob | White / black / yellow | Light preferred; usable on soft dark with care |
| **82 icons** | Black mono on transparent (+ soft AA noise) | Black | Light UI; clean to solid mono, optional yellow recolor |

### Wrong usage (fixed)

- Placing pack 6 / transparent black art on **dark** auth panels  
- Ignoring the icon pack entirely  

### Correct usage

- **Split auth** → pack 6 on **light** panel + white frame  
- **Trust / help chips** → cleaned mono **icons**  
- **Empty states** → pack 25 line art on soft light plate  

## Pack 6 → auth / story map

| Key | Source theme |
|-----|----------------|
| `authBuyer` | Add to cart |
| `authSeller` | Doorstep delivery |
| `authAdmin` | Customer support |
| `cashOnDelivery` | Cash on delivery |
| `doorstepDelivery` | Doorstep delivery |
| `customerSupport` | Support |
| `shoppingSale` | Big shopping sale |
| `addToCart` | Add to cart |

*(Negative review illustration intentionally unused.)*

## Icons (curated 20)

`public/icons/{name}.png|.webp` and `{name}-yellow.*`  

cart, add-to-cart, checkout, account, address, order, delivery-truck, deliver, wallet, money, seller, support, security, wishlist, location, search-market, return, sales-analytics, invoice, customer  

## Components

- `Illustration` — auto light plate for `style: "silhouette"`  
- `AuthSplitLayout` — light cream panel for pack 6  
- `Icon` — mono ink / yellow  
- `TrustStrip` — icons, not large illustrations  

## Surfaces

| Surface | Assets |
|---------|--------|
| Buyer / Seller / Admin login split | Pack 6 + light panel |
| Home / checkout trust | Icons |
| Help | Pack 6 support + icons |
| Empty cart/orders/catalog | Pack 25 line art |
