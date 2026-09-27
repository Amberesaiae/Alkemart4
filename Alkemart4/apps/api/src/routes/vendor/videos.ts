import { MAX_VIDEOS_PER_PRODUCT, VideoLinkError, parseVideoLink } from "@alkemart/domain"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { publicVideo } from "../../lib/videos"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"
import { VideoExistsError } from "../../videos-store"

/** Seller adds TikTok / Instagram / YouTube links to their own listings; admin approves before they show. */
const AddBody = z.object({ productId: z.string().min(1), url: z.string().trim().min(8).max(500) })

function sellerOf(c: Context<AppEnv>) {
  const id = c.get("auth").sellerId
  if (!id) throw new HTTPException(403, { message: "forbidden" })
  return id
}

async function assertSells(c: Context<AppEnv>, sellerId: string, productId: string) {
  const mine = await c.get("repo").listVendorProducts(sellerId)
  if (!mine.some((p) => p.product.id === productId)) throw new HTTPException(404, { message: "product not found" })
}

export const vendorVideos = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const sellerId = sellerOf(c)
    const productId = c.req.query("productId")
    const rows = await c.get("videos").listVideos({ sellerId, ...(productId ? { productIds: [productId] } : {}) })
    return c.json({ items: rows.map(publicVideo), max: MAX_VIDEOS_PER_PRODUCT })
  })
  .post("/", async (c) => {
    const sellerId = sellerOf(c)
    const parsed = AddBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Paste the full link from TikTok, Instagram or YouTube." })
    await assertSells(c, sellerId, parsed.data.productId)
    let v
    try {
      v = parseVideoLink(parsed.data.url)
    } catch (e) {
      if (e instanceof VideoLinkError) throw new HTTPException(400, { message: e.message })
      throw e
    }
    const store = c.get("videos")
    const existing = await store.listVideos({ sellerId, productIds: [parsed.data.productId], statuses: ["pending", "approved"] })
    if (existing.length >= MAX_VIDEOS_PER_PRODUCT) throw new HTTPException(409, { message: `A listing can have up to ${MAX_VIDEOS_PER_PRODUCT} videos. Remove one first.` })
    try {
      const row = await store.addVideo({ productId: parsed.data.productId, sellerId, platform: v.platform, videoId: v.videoId, url: v.url })
      return c.json({ video: publicVideo(row) }, 201)
    } catch (e) {
      if (e instanceof VideoExistsError) throw new HTTPException(409, { message: e.message })
      throw e
    }
  })
  .delete("/:id", async (c) => {
    const ok = await c.get("videos").removeVideo(c.req.param("id"), sellerOf(c))
    if (!ok) throw new HTTPException(404, { message: "video not found" })
    return c.json({ ok: true })
  })
