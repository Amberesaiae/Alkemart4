# Production demo purge — 2026-07-19

## Storefront
- `VITE_HOME_DEMO=0` (required)
- Home / browse / rail use **API only** (`lib/catalog-nav.ts`)
- Demo seed module retired (`lib/demo/home-seed.ts` fails closed)
- Product cards no longer invent 5-star ratings or demo badges

## Neon (soft-delete)
**Kept admins**
- `isaiahamber5@gmail.com`
- `akpey.mawuena@gmail.com`

**Removed**
- `admin@alkemart.local`
- Lab sellers: `seller@alkemart.local`, `vendor.accra@alkemart.local`, `member.tema@alkemart.local` (handles alkemart-lab-shop, accra-market, tema-fresh)
- Lab/e2e customers (`*@alkemart.local`, e2e@example.com, etc.)
- Lab/e2e products (`lab-*`, `e2e-*`, Live E2E titles)
- Offers for deleted sellers/products

**Kept non-lab vendor**
- Lamp Store (`khophyaero@gmail.com` / `lamp`) if present

Script: `scripts/purge-lab-demo.sql` (and `/tmp/purge-lab-demo.sql` run once)

## Expectation
Catalog may be empty until real vendors list sellable offers. That is correct for production honesty.
