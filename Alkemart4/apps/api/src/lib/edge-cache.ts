/**
 * Foundational CDN approach (single source of truth — see
 * `docs/architecture/workers/CDN-APPROACH.md`).
 *
 * Verified platform facts (Cloudflare docs, 2026):
 * - JSON/HTML are NOT cached by default; `Cache-Control: public` + `max-age>0`
 *   on a GET opts in. Private routes are safe by default AND carry explicit
 *   `no-store` so a future "cache everything" rule can never leak them.
 * - Any `Set-Cookie` on a response disables caching — the API never sets
 *   cookies (Bearer auth), so public GETs stay cacheable.
 * - Simultaneous MISSes collapse to one origin fetch per PoP (request
 *   collapsing) — the platform already singleflights; code must not duplicate it.
 * - Tiered Cache (Smart topology, Free included) needs a custom-domain zone;
 *   `workers.dev` origins can't use it — operator step in the CDN doc.
 *
 * Matrix:
 * - catalog (prices/stock move): 60s edge, SWR tail.
 * - merchandising (taxonomy/guides/collections/course/homepage): 300s edge.
 * - build (sitemap/feed): 600s edge.
 * - media (`/media/*` in uploads.ts): immutable 1y + ETag (content-addressed).
 * - everything authed/personal/mutating: `no-store` via `noStoreHeaders`.
 */
import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../context"

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

/**
 * Mount on every private surface (vendor/admin apps, webhooks, cart,
 * checkout, orders, preferences, subscriptions, experiments, auth). Runs
 * before route handlers; a route that later calls `edgeCache()` replaces
 * the header, so public-on-private-mount stays impossible by accident.
 */
export const noStoreHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.header("Cache-Control", "no-store")
  await next()
}
