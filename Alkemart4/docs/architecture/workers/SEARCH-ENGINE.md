# Search engine: stay on Postgres now, Meilisearch later

Written 2026-09-26, answering "Meilisearch or Cloudflare?"

## Recommendation

**Keep Postgres search for launch. Plan Meilisearch (Cloud) as the upgrade,
triggered by clear signals. Don't build on Cloudflare's search products for
product search.**

## What we have today

- Postgres `pg_trgm` fuzzy matching (migration 0031): typo-tolerant title
  search with tuned similarity thresholds.
- Search words (synonyms and redirects) managed in admin Analytics.
  Proven in the sandbox: "phone" found nothing until a synonym was added.
- Every search is logged (`search_query_log`) with its result count. Admin
  Analytics shows top searches, the zero-result rate and a daily chart.
- A `search_outbox` projection queue already exists, so a separate search
  index can be fed later without touching write paths.

For a young catalogue (thousands, not millions, of listings) this is fast,
cheap, has no extra system to run, and is always consistent with stock and
price, because it reads the same database as checkout.

## Options compared

| | Postgres (now) | Meilisearch Cloud | Cloudflare (Vectorize / AI Search) |
|---|---|---|---|
| Typo tolerance | Good (trigram) | Excellent, built in | Semantic only, weak on SKUs and brands |
| Facets and filters (price, rating, category, seller) | SQL, fine at our size | Built in, very fast | Not a faceted engine |
| Relevance tuning | Manual | Ranking rules, synonyms, stop words out of the box | Embedding quality only |
| Freshness (stock, price) | Always exact | Seconds behind (via outbox) | Behind; needs its own pipeline |
| Cost at launch | Already paid | About $30+/month | Cheap per query, but you build the rest |
| Runs from Workers | Yes (Hyperdrive) | Yes (HTTPS API) | Yes (native) |
| Ops burden | None | Low (managed) | Medium (we'd build ranking and facets) |

Cloudflare's offerings are vector and semantic search. They're good for
"shoes for a wedding"-style questions, but poor at what marketplace
shoppers mostly type: brand, model and size ("tecno spark 20 128gb"). If we
ever want semantic search, add it next to keyword search as a fallback for
zero-result queries, not instead of it.

## When to move to Meilisearch

Move when **any** of these show up in admin Analytics:

1. The zero-result rate stays above **15%** after a few weeks of adding
   search words.
2. Search responses slow down noticeably as the catalogue grows (roughly past
   **50k active listings**, or complex facets start taking hundreds of
   milliseconds).
3. We need instant, as-you-type product results with facets on every
   keystroke.

## How the move would work (no big bang)

1. A worker drains `search_outbox` into a Meilisearch index (products, offers
   rolled up per product, category path, seller rating, delivery promise).
2. Mirror the admin search words into Meilisearch synonyms.
3. Run both for a week behind an experiment flag; compare zero-result rate
   and click-through in PostHog (`search_performed` → `product_viewed`).
4. Switch reads to Meilisearch; Postgres stays the source of truth. Prices
   and stock shown on product pages and at checkout are always read live.
