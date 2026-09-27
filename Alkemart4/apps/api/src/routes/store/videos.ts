import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { publicVideo } from "../../lib/videos"

/** Approved product videos, and the featured "Watch & shop" row with its products. */
export const storeVideos = new Hono<AppEnv>()
  .get("/", async (c) => {
    const productId = c.req.query("productId")
    if (!productId) throw new HTTPException(400, { message: "productId required" })
    const rows = await c.get("videos").listVideos({ productIds: [productId], statuses: ["approved"] })
    c.header("Cache-Control", "public, max-age=120")
    return c.json({ items: rows.map(publicVideo) })
  })
  .get("/featured", async (c) => {
    const rows = (await c.get("videos").listVideos({ statuses: ["approved"], featured: true })).slice(0, 12)
    const cards = await c.get("repo").productCardsByIds([...new Set(rows.map((v) => v.productId))]).catch(() => new Map())
    c.header("Cache-Control", "public, max-age=120")
    return c.json({
      items: rows
        .filter((v) => cards.has(v.productId))
        .map((v) => {
          const p = cards.get(v.productId)!
          return { ...publicVideo(v), product: { id: p.productId, title: p.title, fromPricePesewas: p.fromPricePesewas, currency: p.currency, imageUrl: p.imageUrl } }
        }),
    })
  })
