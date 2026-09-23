import { Hono } from "hono"
import type { AppEnv } from "../../context"

/**
 * Phase 6D — merchant feed rows (JSON). The build-time prerender absolutizes
 * links with the site origin and emits dist/feed.xml; this endpoint stays
 * origin-free so staging, preview, and production never disagree.
 */
export const storeFeed = new Hono<AppEnv>().get("/", async (c) => {
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 200) || 200))
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0)
  const items = await c.get("repo").listFeedProducts(limit, offset)
  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
  return c.json({ items, count: items.length, limit, offset })
})
