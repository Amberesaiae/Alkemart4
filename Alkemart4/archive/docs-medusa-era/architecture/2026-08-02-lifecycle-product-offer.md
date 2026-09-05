# Product & Offer Lifecycle — Detailed

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — as-built |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |

---

## 1. Model

```
Seller ──(Mercur link module)── Product ── ProductVariant(s)
                                    │            │
                                    └── Offer ───┘      ← THE sellable record
                                         ├─ seller_id, product_id, variant_id, sku
                                         ├─ prices → PriceSet   (integer pesewas)
                                         └─ inventory_items     (stock levels)
```

- **Product** carries content (title, description, media, category); statuses `draft | proposed | published | rejected`.
- **Offer** carries commerce (price, stock) per seller. Buyers buy offers; vendors edit offers.
- A product is **publicly sellable** iff: `status = published` AND seller active + ready AND offer priced AND stocked (`lib/product-sellable.ts`).

## 2. Creation Paths

### 2.1 Full path — `POST /vendor/alkemart/products`
Vendor creates product with variants; server links it to the seller and creates offers.

### 2.2 Quick-list — `POST /vendor/alkemart/quick-list`
Fast onboarding path: creates Product in **`proposed`** status, links seller, runs `createOffersWorkflow` to attach price + stock in one shot. Designed so a new Ghana seller can list sellable inventory in minutes.

## 3. Quality & Moderation Pipeline

```
proposed product
  → lib/product-quality.ts scoring (completeness: media, description, pricing)
  → admin moderation (/admin/alkemart/moderation, reasons in lib/moderation-reasons.ts)
      approve → published        reject → rejected (+reason, vendor notified)
```

- `product-lifecycle-notify` subscriber → vendor SMS/WA on approve/reject.
- Admin can also manage via `/admin/products`, feature via `/admin/featured-products`.

## 4. Media Pipeline

```
vendor uploads (file module → S3/Tigris; file-local in dev)
  → product-media-pending subscriber flags
  → process-product-images job: resize, webp variants, write back to S3
  → storefront serves responsive webp (PDP gallery)
```

Never process images inline in a request. The job is idempotent per flagged asset.

## 5. Pricing & Stock

- All prices integer **pesewas** in PriceSets; `lib/offer-pricing.ts` owns computation.
- Vendor dashboard (`products.$id.tsx` → Inventory & Pricing): price editable per offer via `offers.update`; **stock currently read-only** (task #14 — endpoint must validate seller scope and update inventory levels).
- Price/stock changes → `search-offer-sync` reindex + `catalog-cache-invalidate`.

## 6. Search & Discovery Sync

| Change | Subscriber | Index effect |
|---|---|---|
| product create/update | `search-product-sync` | upsert doc |
| product delete | `search-product-delete` | remove doc |
| offer price/stock | `search-offer-sync` | update commerce fields |
| seller status | `search-seller-sync` | show/hide seller's docs |
| drift safety net | `recompute-sellable-search` job | full reconcile |

Admin can force `POST /admin/search/reindex`.

## 7. Invariants

1. **Publishing is an admin decision** — vendors can reach `proposed`, never `published`, on their own.
2. Sellability is computed, never stored as an editable flag.
3. Offers are seller-scoped at query level in every `/vendor` route — the client never sends `seller_id`.
4. New product surfaces (feeds, collections, promos) must filter through `product-sellable`, not raw `status`.
