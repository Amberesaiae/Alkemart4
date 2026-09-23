import { buildNavTree } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { edgeCache } from "../../lib/edge-cache"

/**
 * Buyer nav tree: active, nav-visible nodes only (Phase 1A).
 * Display names fall back to canonical names; slugs fall back to handles,
 * so pre-lifecycle rows keep serving identical shapes.
 * Deprecated slugs resolve via GET /store/categories/resolve (buyer routes
 * 301 to the replacement; see Phase 1 plan).
 */
export const categories = new Hono<AppEnv>()
  .get("/", async (c) => {
    const nodes = await c.get("repo").listTaxonomyNodes()
    const tree = buildNavTree(
      nodes
        .filter((n) => n.status === "active" && n.isNavVisible)
        .map((n) => ({
          id: n.id,
          handle: n.slug ?? n.handle,
          name: n.displayName ?? n.canonicalName,
          parentId: n.parentId,
          rank: n.sortOrder,
        })),
    )
    edgeCache(c, "merchandising")
    return c.json({ categories: tree })
  })
  .get("/resolve", async (c) => {
    const slug = c.req.query("slug")?.trim()
    if (!slug) throw new HTTPException(400, { message: "slug required" })
    const hit = await c.get("repo").resolveCategoryRedirect(slug)
    if (!hit) throw new HTTPException(404, { message: "category not found" })
    return c.json(hit)
  })
