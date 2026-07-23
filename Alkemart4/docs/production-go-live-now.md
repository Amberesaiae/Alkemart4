# Production go-live — real deal (2026-07-19)

## Clean slate (done)

| Surface | State |
|---------|--------|
| Storefront demo | **OFF** (`VITE_HOME_DEMO=0`), no seed fill |
| Lab admin | **Removed** (`admin@alkemart.local` auth dead) |
| Lab sellers | **Removed** (tema / accra / lab-shop) |
| Lab/e2e customers | **Removed** |
| Live admins | `isaiahamber5@gmail.com`, `akpey.mawuena@gmail.com` |
| Live seller | **Lamp Store** — `khophyaero@gmail.com` / handle `lamp` |

## Live commerce spine

| Metric | Count | Notes |
|--------|------:|--------|
| Open sellers | 1 | Lamp Store |
| Published products | 7 | Orphaned of offers when lab sellers purged |
| Live offers | 0 | **Catalog empty until seller lists prices** |
| Sellable catalog API | 0 | Correct / honest |

## Performance before real traffic

Tick **P0** (always-on Neon, one API process, pooler) before marketing traffic:

→ [architecture/2026-07-19-performance-practices.md](./architecture/2026-07-19-performance-practices.md)  
→ [architecture/2026-07-19-performance-P0-checklist.md](./architecture/2026-07-19-performance-P0-checklist.md)

Seller product list isolation (no shared lab catalog):

→ [architecture/2026-07-19-seller-product-isolation.md](./architecture/2026-07-19-seller-product-isolation.md)

## What “real deal” means next (no lab accounts)

### 1. Admins (you two)
1. Open **Admin** → http://localhost:7000/dashboard (or `:9000/dashboard`)
2. Sign in with **your Gmail admin** account
3. Approve pending sellers when they register
4. Publish products that pass quality gates

### 2. Real vendor (Lamp Store or new sellers)
1. Open **Seller Hub** → http://localhost:7001/seller (or `:9000/seller`)
2. Sign in as `khophyaero@gmail.com` (Lamp Store) **or** register a new seller
3. Complete onboarding: address → stock location → shipping
4. Create product → upload real photos → create **offer** (GHS price + inventory)
5. Propose for review if gates require admin publish

### 3. Buyer storefront
1. http://localhost:5175 — **no demo tiles**
2. Empty “Last Offers” is intentional until step 2 creates offers
3. Buyer path: browse → ATC (`offer_id`) → Ghana COD → order email lookup

## Stack (local)

| Service | URL |
|---------|-----|
| API | http://localhost:9000 |
| Shop | http://localhost:5175 |
| Admin panel | http://localhost:7000/dashboard |
| Seller panel | http://localhost:7001/seller |

Wake Neon if API hangs:
```bash
echo 'select 1;' | neonctl psql medusa-prod \
  --project-id wispy-union-10280789 --database-name alkemart_marketplace
```

## Do not
- Re-enable `VITE_HOME_DEMO=1`
- Re-run `ensure-lab-commerce` / `seller@alkemart.local` seeds for production
- Invent catalog prices or stars in the SPA

## Production checklist (hour-0)

- [x] Demo UI off
- [x] Lab identities purged; two real admins remain
- [x] Catalog fail-closed (no offers → empty, not fake cards)
- [ ] First real offer listed under live seller (Lamp or new)
- [ ] Admin publishes / approves that listing
- [ ] Buyer COD order on that offer
- [ ] Guest order lookup with checkout email
- [ ] CORS / secrets for real deploy host (see DEPLOYMENT.md)
