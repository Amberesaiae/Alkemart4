# alkemart storefront v2

The buyer storefront, rebuilt from a fresh `shadcn create` (Vite + React 19 +
Radix, **Maia** preset, Figtree, **Hugeicons**) on the Workers API. No code
from the old UI; the data layer was carried over and cut down to Workers-only
(no Medusa branches anywhere).

```bash
bun install                                   # from Alkemart4/
cp apps/storefront-v2/.env.template apps/storefront-v2/.env.local
bun run dev:api                               # Workers API on :8787 (see docs/architecture/workers/LOCAL-DEV.md)
bun run dev:storefront-v2                     # http://localhost:5176
```

`bun run --cwd apps/storefront-v2 <typecheck|lint|test|build>`

## Layout

```
src/
  routes/            TanStack file routes (one per page)
  components/ui/     shadcn components (owned, lightly extended: Button `brand`/`xl`)
  components/shell/  header, search typeahead, departments menu, deliver-to, tab bar, footer
  components/commerce/ product card, quick-buy sheet, offer list, price, rating, tiles, store card…
  components/home|product|listing|checkout|content|feedback/
  hooks/             use-store (cart/session/categories), use-offer-selection, use-shelf…
  lib/               Workers data layer (products, cart, checkout, orders, vendors, search…)
    market.ts        the ONE place a country is named (currency, phone, address, regions, MoMo)
    offer-selection.ts  pure "which offer does Add to cart bind?" rules (tested)
    departments.ts   category → tile colour, glyph and art paths
```

## Principles

- **Honest data only.** Badges, ratings, counts, "lowest total" and "sold by"
  come from the API. Nothing is invented to look busy; outages show as errors,
  never as empty results.
- **One selection rule.** PDP and card quick-buy share `lib/offer-selection.ts`:
  variants must be complete, multi-seller items require a seller choice.
- **Market-agnostic.** Components read `useMarket()`; Ghana is a data entry.
  Adding a market = adding config (and later, admin-managed via the API).
- **Assets are contracts.** Art lives at fixed paths with graceful fallbacks —
  see `docs/CODEX-ASSETS.md` (includes the prompt for Codex).

Issues found in the old storefront and how v2 handles them:
`docs/ISSUES-FOUND.md`.

## Rewire plan (v2 → the storefront)

1. Codex delivers assets (`docs/CODEX-ASSETS.md`), then click through the
   buyer flow on :5176 including a real COD order against a test seller.
2. Deploy v2 to a preview Pages project; run `bun run smoke` against it.
3. Swap: move `apps/storefront` → `archive/storefront-v1`, rename
   `apps/storefront-v2` → `apps/storefront` (package name back to
   `@workspace/storefront`, port 5175), update root `package.json` workspaces
   and scripts, `scripts/deploy-pages.sh`, `LOCAL-DEV.md`, `LIFECYCLE-BUYER.md`.
4. Carry over what v1 had that v2 intentionally dropped: the service worker /
   offline page (vite-plugin-pwa) and the PDP prerender script
   (`scripts/prerender-pdp.mjs`) if SEO for product pages is still wanted.
