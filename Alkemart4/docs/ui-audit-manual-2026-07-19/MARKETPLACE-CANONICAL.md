# Alkemart storefront — canonical marketplace plan

Audience: Ghana multi-seller shoppers (Jumia-like behaviour, alkemart yellow brand).
Skeleton references: Walmart (search-first header, dept rail, product grids), Amazon (PDP buy box, filters), not dark SaaS marketing pages.

## Storefront (implemented this pass)

| Surface | Canonical pattern |
|---------|-------------------|
| **Home** | Light COD/value strip · popular searches · dept rail · **featured product grid** · dept tiles · sellers · trust · assortment |
| **Browse** | Breadcrumb · title · **always-on Filters** (sort, department, seller) · product grid |
| **PDP** | Gallery · about · **right buy box** (price, stock, qty, add, seller) · related |
| **Search** | Landing suggestions + facets when querying |
| **Header** | Logo · search · language · account · cart · dept nav |

Removed: dark black discovery banner, bento collage as primary featured treatment.

## Gaps still open (manual / later)

### Storefront
- Real product photos (seller upload)
- Meilisearch on for rich facets at scale
- Reviews / ratings (not in v1 schema)
- Wishlist
- Order tracking deep links

### Seller Hub (approach)
- Product create must force **image first** before publish
- Offer + price in same flow (not orphan products)
- Store readiness checklist visible until complete
- Multi-store switcher clearer after login

### Admin (approach)
- Queue empty states should teach next action
- Product review: show thumbnail large, reject reasons human-readable
- Seller approve: surface missing readiness fields
- Don’t expose Mercur jargon in ops UI

## Design rules (alkemart)

1. Yellow = CTA only; pages stay white/light gray  
2. Square corners on primary retail CTAs (cards can stay slight radius sparingly)  
3. Filters always visible on listings (desktop); toggle on mobile  
4. One product grid language everywhere  
5. No engineering copy in customer UI  
