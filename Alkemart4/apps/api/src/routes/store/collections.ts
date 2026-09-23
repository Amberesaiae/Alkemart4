import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ProductCardDto } from "@alkemart/domain"
import type { CollectionDto } from "../../collections"
import type { AppEnv } from "../../context"
import { edgeCache } from "../../lib/edge-cache"

async function withCards(
  c: { get(k: "repo"): AppEnv["Variables"]["repo"] },
  item: CollectionDto,
): Promise<{ collection: CollectionDto; cards: ProductCardDto[] }> {
  const byId = await c
    .get("repo")
    .productCardsByIds(item.productIds)
    .catch(() => new Map<string, ProductCardDto>())
  // Rank order is the shelf; products that vanished simply drop out.
  const cards = item.productIds.flatMap((id) => {
    const card = byId.get(id)
    return card ? [card] : []
  })
  return { collection: item, cards }
}

/**
 * Phase 4A public reads — published, in-window shelves only. Drafts,
 * scheduled-future, and expired collections 404 as if they never existed.
 */
export const storeCollections = new Hono<AppEnv>()
  .get("/", async (c) => {
    const sellerId = c.req.query("seller_id")?.trim()
    if (!sellerId) throw new HTTPException(400, { message: "seller_id required" })
    const items = await c.get("collections").listPublishedBySeller(sellerId)
    edgeCache(c, "merchandising")
    return c.json({
      items: await Promise.all(items.map((item) => withCards(c, item))),
    })
  })
  .get("/:id", async (c) => {
    const sellerId = c.req.query("seller_id")?.trim()
    if (!sellerId) throw new HTTPException(400, { message: "seller_id required" })
    const items = await c.get("collections").listPublishedBySeller(sellerId)
    const item = items.find((i) => i.id === c.req.param("id"))
    if (!item) throw new HTTPException(404, { message: "collection not found" })
    return c.json(await withCards(c, item))
  })
