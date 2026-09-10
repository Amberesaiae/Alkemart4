import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"

/**
 * GET /vendor/stats/shop — seller's own traffic: 30-day views series,
 * top viewed products, and derived conversion (orders ÷ views).
 */
export const vendorShopStats = new Hono<AppEnv>().use("*", requireSeller).get("/", async (c) => {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  const [{ series, top }, products, orders] = await Promise.all([
    c.get("traffic").shopStats(sellerId),
    c.get("repo").listVendorProducts(sellerId).catch(() => []),
    c.get("checkoutRepo").listOrdersForSeller(sellerId).catch(() => []),
  ])
  const byId = new Map(
    products.map((p) => [p.product.id, { title: p.product.title, thumbnail: p.product.imageUrl ?? null }]),
  )
  const views30d = series.reduce((s, d) => s + d.views, 0)
  return c.json({
    views30d,
    conversion: views30d > 0 ? orders.length / views30d : 0,
    series,
    top: top.map((t) => ({
      productId: t.productId,
      title: byId.get(t.productId)?.title ?? t.productId,
      thumbnail: byId.get(t.productId)?.thumbnail ?? null,
      views: t.views,
    })),
  })
})
