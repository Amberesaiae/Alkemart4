# UI/UX screenshot audit — alkemart Ghana SPA

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **URL** | http://localhost:5175 |
| **Viewports** | Desktop 1440×900 · Mobile 390×844 (full page) |
| **Method** | Playwright + Chromium headless, networkidle + 2.5s settle |

## Screenshots

| File | Surface |
|------|---------|
| `01-home-desktop.png` / `01-home-mobile.png` | Home modules |
| `02-browse-desktop.png` / `02-browse-mobile.png` | PLP `/browse/all` |
| `03-pdp-desktop.png` / `03-pdp-mobile.png` | PDP (id link) |
| `04-cart-desktop.png` / `04-cart-mobile.png` | Cart empty |
| `05-checkout-desktop.png` / `05-checkout-mobile.png` | Auth gate (checkout requires login) |
| `06-help-desktop.png` / `06-help-mobile.png` | Help |

## Findings summary

See conversation audit for severity table.

### Fix pass (2026-07-16 “go”)

| Issue | Fix |
|-------|-----|
| Empty catalog | Removed bare `variants.offer_id` field (broke store list) |
| Header triple Sign in | Location → “Accra area”; Account label; guest person icon |
| Empty category tiles | Letter chips with soft tones |
| Hero carousel chrome | Removed; brand panel when no image |
| Empty product rails | Collapse when empty; single `CatalogEmptyHint` |
| Delivery empty image | Two-column band only |
| Cart CTA when empty | Secondary disabled “Add items to checkout” |
| PDP id/handle | retrieve + list fallbacks |
