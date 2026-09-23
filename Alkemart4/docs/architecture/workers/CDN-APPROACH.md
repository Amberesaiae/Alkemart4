# CDN approach — foundational

**Status:** Canonical. Single source of truth for what caches where, enforced by
`apps/api/src/lib/edge-cache.ts` (`edgeCache()` + `noStoreHeaders`, pinned by
`edge-cache.test.ts`). Verified against Cloudflare docs 2026-09-23 (Queues/RLS
day — search engine down, docs fetched direct).

## Verified platform facts

1. **JSON/HTML are NOT cached by default.** `Cache-Control: public` + `max-age>0`
   on a GET opts in. ([Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/))
2. **Any `Set-Cookie` disables caching.** The API never sets cookies (Bearer
   auth everywhere) — public GETs stay cacheable. Keep it that way.
3. **Simultaneous MISSes collapse** to one origin fetch per PoP (request
   collapsing / cache lock). The platform singleflights; code must not duplicate it.
4. **Tiered Cache Smart topology is Free** and needs a custom-domain zone —
   `workers.dev` origins can't use it. ([Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/))
5. Cacheable size limit 512 MB (Free/Pro/Business); upload limit 100 MB —
   our 5 MB media cap is far inside both.

## Matrix (all TTLs in `edge-cache.ts`, none anywhere else)

| Surface | Policy | Why |
|---|---|---|
| `/store/catalog` (+ search/products/sellers reads) | `public, max-age=6, s-maxage=60, SWR 300` | prices/stock move; edge absorbs stampedes, SWR covers revalidation tail |
| merchandising (categories, guides, collections, course, homepage) | `s-maxage=300` | slow-moving; hand-edited content |
| build (sitemap, feed) | `s-maxage=600` | polled rarely by machines |
| `/media/*` (R2) | `public, max-age=31536000, immutable` + ETag | content-addressed keys (`{kind}/{owner}/{uuid}[.thumb].{ext}`); allowlisted key pattern; magic-byte sniffed uploads; WebP variants via Images binding in prod |
| vendor/*, admin/* (whole apps) | `no-store` (mount middleware) | every response is authed/personal |
| `/hooks/paystack` | `no-store` | webhooks must never replay from cache |
| store private (auth, cart, checkout, orders, preferences, subscriptions, experiments) | `no-store` | personal/mutating/assignment responses |
| everything else | no header → default no-cache for JSON | fail-closed; caching is opt-in per route |

Precedence rule (tested): mount-level `no-store` applies first; a route that
later calls `edgeCache()` replaces it. Public-on-private-mount is impossible
by accident, and a future "cache everything" dashboard rule can never leak
authed JSON because the origin header says `no-store`.

## Operator steps (dashboard, not code)

1. **Custom domain for the API** (e.g. `api.alkemart.com`) → unlocks Tiered
   Cache (Smart, Free) + Cache Rules + purge-by-URL. Set a cloud region hint
   for the Hyperdrive origin side where applicable.
2. **Tiered Cache → ON, Smart topology** once the domain exists. Verify via
   `CacheTieredFill` in http_requests logs.
3. **Purge policy = TTLs.** No purge API calls in code paths; 60s max stale on
   catalog is the contract. Unpublish flows rely on `isSellable` filtering at
   query time, not on cache invalidation.
4. **Pages static assets** inherit Cloudflare's extension-based caching
   (JS/CSS/images) automatically — no config.

## Media strategy

Upload (`POST /vendor/uploads`, seller JWT, 5 MB, magic-byte allowlist) →
R2 original always kept → Images binding derives ≤1600px WebP + 400px thumb in
prod (local stub stores original only). Serve same-origin `/media/<key>` so
`imageUrl` validators pass without public-bucket wiring; immutable headers mean
the edge holds bytes for a year and variants are new keys, never overwrites.
