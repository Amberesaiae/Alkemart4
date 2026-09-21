# 01 — Product thesis and information architecture

**Boards:** `boards/app-ia.png`, `boards/app-journey.png`, Behance brief on both galleries.

---

## Product thesis

Mowafer is not a single-warehouse shop. It is:

1. **Discovery** — groceries + electronics (+ adjacent categories) across a market.
2. **Comparison** — on PDP, an **Other Prices / Retailers** table (Jumia, Souq, Noon, local stores).
3. **Commerce** — own cart + checkout (COD, cards, loyalty points).
4. **Delivery** — address + delivery method + (mobile) time slots.
5. **Growth** — Advertise With Us / seller acquisition band on web home.

**Alkemart translation:** multi-**seller** marketplace with peer offers on one product. Comparison soul stays; scraping external retailers does not.

---

## Information architecture (4 levels)

From app board **01 Information Architecture**:

```
Home
├── Featured Offers ──► Product ──┬── Comparison
│                                 ├── Cart ──► Checkout
│                                 │              ├── Shipping Address
│                                 │              ├── Delivery Method
│                                 │              └── Payment Method
├── All Categories ──► Product ───┘
├── Account ──► Log in / Sign up ──► Account Settings ──► Points
├── Wishlist
├── Customer Care ──► FAQ · Privacy · Terms
├── Articles
├── About Us
└── Contact
```

**Hub rule:** Product is the hub. **Add to Cart** is the golden path. Comparison is a fork, not a replacement for cart.

---

## Primary journeys

### J1 — Browse & buy (web)

```
Home → mosaic tile OR icon rail
  → PLP (filters + colored side panels)
  → card Add / open PDP
  → Add to Cart
  → Cart table
  → Checkout: Address → Delivery → Payment → Success → Track
```

### J2 — Deals path (mobile)

```
Splash → Home → Deals Of The Day → PDP
  → Other Prices (optional)
  → Add to Cart (toast)
  → Cart → Place Order → Address → slots → COD → Done → My Orders
```

### J3 — Account (defer heavy branches)

Orders · Wishlist · Points · Pending Reviews · Settings (address, language) · Sign out.

**v1 Alkemart:** Orders + addresses + auth. Wishlist / points / reviews queue deferred.

---

## Depth and gates

| Level | Screens | Gate |
|-------|---------|------|
| L1 | Home, Account entry, Articles entry | Public |
| L2 | Category PLP, Product, Cart, Wishlist | Catalog / session |
| L3 | Comparison, Cart edits | Product hub |
| L4 | Checkout steps | Auth optional; payment required |

---

## Acceptance

- [ ] Rebuild IA diagram matches this tree (minus deferred nodes marked in `10-alkemart-adaptations.md`)
- [ ] No page invents a fifth primary nav destination beyond Home / browse / Search / Account / Cart (mobile tabs)
- [ ] PDP always exposes a path to peer offers when `offerCount > 1`
