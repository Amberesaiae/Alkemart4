import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { trackView } from "../../traffic"

export const products = new Hono<AppEnv>().get("/:id", async (c) => {
  const id = c.req.param("id")
  const reviews = await c.get("checkoutRepo").listPublishedReviewsByProduct(id).catch(() => [])
  const detail = await c.get("repo").getProduct(id, reviews)
  if (!detail) throw new HTTPException(404, { message: "product not found" })
  trackView(c, detail.offers[0]?.sellerId, detail.productId)
  return c.json(detail)
})
