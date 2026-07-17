# Search ops (Meilisearch) — Alkemart

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Status** | Phase 2 foundation |
| **Plan** | `2026-07-17-data-search-seo-ghana-adaptation-plan.md` |

## Local Meilisearch

### Docker (preferred)

```bash
# from monorepo root
docker compose -f docker-compose.search.yml up -d
```

Default master key (dev only): `alkemart_dev_master_key_change_me`

### Binary (when Docker is unavailable)

```bash
# example Linux amd64 release
curl -sSL -L -o ~/bin/meilisearch \
  https://github.com/meilisearch/meilisearch/releases/download/v1.14.0/meilisearch-linux-amd64
chmod +x ~/bin/meilisearch
MEILI_ENV=development MEILI_MASTER_KEY=alkemart_dev_master_key_change_me \
  ~/bin/meilisearch --db-path ~/meili_data --http-addr 127.0.0.1:7700
```

## API env (`apps/backend/packages/api/.env`)

```bash
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=alkemart_dev_master_key_change_me
MEILISEARCH_INDEX_UID=products
```

Unset `MEILISEARCH_HOST` → search routes return `engine: "disabled"`; storefront uses Medusa `product.list`.

## Reindex (Search sync)

```bash
cd packages/api   # or Linux worktree
medusa exec ./src/scripts/reindex-search.ts
# or authenticated:
# POST /admin/search/reindex
```

Health: `GET /store/search?health=1` (publishable key header).

## Commerce stats (ops)

```bash
medusa exec ./src/scripts/print-commerce-stats.ts
# authenticated admin:
# GET /admin/alkemart/stats
```

Returns product/seller/offer/order counts and `gmv_by_currency` from the order graph (not a BI warehouse).

## Storefront

- `/search` uses `POST /store/search` when Meilisearch is up.
- Facets render only attributes with counts (self-building).
- URL state: `?q=&category=a,b&seller=handle`

## Do not

- Market Meilisearch by name in buyer UI (say “Search” / “Filters”).
- Index draft products (only `status = published`).
- Put PII into the index.
