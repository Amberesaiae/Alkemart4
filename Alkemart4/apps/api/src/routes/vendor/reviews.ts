import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

const RespondBody = z.object({
  message: z.string().trim().min(1).max(2000),
})

function sellerReview(r: {
  id: string
  orderId: string
  productId: string
  rating: number
  title: string | null
  body: string
  status: string
  vendorResponse: string | null
  respondedAt: Date | null
  createdAt: Date
}) {
  return {
    id: r.id,
    orderId: r.orderId,
    productId: r.productId,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    vendorResponse: r.vendorResponse,
    respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }
}

export const vendorReviews = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/mine", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const reviews = await c.get("checkoutRepo").listReviewsBySeller(sellerId)
    return c.json({ reviews: reviews.map(sellerReview) })
  })
  .post("/:id/respond", async (c) => {
    const parsed = RespondBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const updated = await c
      .get("checkoutRepo")
      .respondToReview(c.req.param("id"), sellerId, parsed.data.message.trim())
    if (!updated) throw new HTTPException(404, { message: "review not found" })
    return c.json({ review: sellerReview(updated) })
  })
