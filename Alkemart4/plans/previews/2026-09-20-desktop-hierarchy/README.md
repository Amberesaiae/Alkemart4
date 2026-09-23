# Desktop homepage — Mowafer hierarchy acceptance

## Reference hierarchy

The desktop storefront now follows the supplied Mowafer composition rather than a generic sequence of independent shelves:

1. Global commerce header and department context
2. Four-part category mosaic
3. `Last Offers` decision area
   - one consistent four-column catalogue grid on desktop;
   - one consistent two-column catalogue grid on mobile;
   - square product media and aligned information blocks;
   - repeated product → seller → price → trust hierarchy;
4. Delivery assurance band
5. Seller-acquisition band
6. Footer

Campaign and store-proof sections remain available to mobile while its dedicated course is pending, but they are removed from the desktop route so the desktop hierarchy matches the reference.

## Product-grid rationale

The category mosaic already carries the page's editorial size contrast. The
offer area is therefore a comparison surface, not another mosaic: all cards
share the same width, image ratio, text alignment, price placement, and action
placement. This makes products easier to scan without competing with the
category artwork above.

No document-level horizontal overflow was detected on desktop.

## Catalogue behavior

The page first requests featured catalogue data, then the general catalogue when featured curation is empty. Production remains honest when both are empty. Local development uses the documented demo catalogue only when the Worker API is unavailable, allowing the visual hierarchy to be inspected and tested.

## Earlier preview files

These captures record the preceding asymmetric iteration and should not be
used as current visual acceptance after the equal-grid correction:

- `viewport-1280.png` — above-the-fold composition
- `offers-1280.png` — decision-area geometry
- `final-1280.png` — complete desktop course
- `viewport-1440.png` — wide desktop composition
- `offers-1440.png` — wide decision-area geometry

## Validation

- Storefront TypeScript check: passed.
- Storefront tests: 126 passed across 12 files.
- Storefront production build: passed.
- Desktop hierarchy regression tests: passed.
