# UI/UX focus (manual first)

Product catalog photos / bulk uploads are **paused** — do those by hand in Seller Hub later.

## What we improved (storefront)

### Homepage = discovery + analytics surface
- Dark **discovery hero**: Ghana multi-seller value prop, trust chips (COD, multi-seller, Accra)
- **Popular search chips** → `/search?q=…` (PostHog: `homepage_search_chip`)
- Department chips in hero (PostHog: `homepage_department_chip`)
- One-shot **`homepage_viewed`** when catalog settles (counts products/categories/sellers)

### Search = marketplace engine landing
- Empty search is no longer “type something”
- Popular suggestions + department grid
- Events: `search_landing_viewed`, `search_suggestion_clicked`, `search_performed`

### Earlier polish kept
- Guest account icon (not “?”)
- Human sign-in / register copy
- Create account opens register mode
- Soft monogram when product has no photo
- Footer / cart customer language

## How to review manually

1. Hard-refresh **http://localhost:5175/**
2. Home → discovery hero, chips, featured, sellers
3. Tap a popular search chip → search results
4. Open **http://localhost:5175/search** empty → suggestions + departments
5. PostHog → Activity for `homepage_viewed` / chip events
6. Sign-in / mobile bottom nav

## Next (manual, when you say so)

- Seller Hub: upload real product photos one by one
- Human QA walk: home → search → PDP → cart → checkout
- Admin queues copy already softened

## Reference intent (top marketplaces)

- **Walmart / Amazon**: search is the product; huge bar + departments
- **Jumia-style regional**: COD trust, multi-seller, mobile-first
- Our adaptation: yellow brand, Ghana copy, discovery hero without auto-carousel
