/**
 * Edge-cache policy for hot public reads (ultra-fast plan, step 2).
 *
 * Cloudflare absorbs these at the edge; the origin snapshot only rebuilds
 * on live traffic or after s-maxage expiry. Personalized, cart, checkout,
 * and admin responses must NEVER use this — only broadly-shared reads.
 *
 * - catalog: 60s edge (prices/stock move; SWR covers the tail)
 * - taxonomy/guides/collections/course: 300s edge (slow-moving merchandising)
 * - sitemap/feed: 600s edge (build-time consumers, polled rarely)
 */
export function edgeCache(
  c: { header: (name: string, value: string) => void },
  kind: "catalog" | "merchandising" | "build",
): void {
  const maxAge = kind === "catalog" ? 60 : kind === "merchandising" ? 300 : 600
  c.header(
    "Cache-Control",
    `public, max-age=${Math.floor(maxAge / 10)}, s-maxage=${maxAge}, stale-while-revalidate=300`,
  )
}
