import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"

const CreateReviewBody = z.object({
  orderId: z.string().min(1),
  buyerEmail: z.string().trim().email().max(254),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().nullable(),
  body: z.string().trim().min(1).max(2000),
})

function publicReview(r: {
  id: string
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

/**
 * POST /store/reviews — verified-purchase review (one per order).
 * The order must be delivered and the email must match the order group.
 * New reviews start `pending` for admin moderation.
 */
export const storeReviews = new Hono<AppEnv>().post("/", async (c) => {
  const parsed = CreateReviewBody.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  const checkout = c.get("checkoutRepo")

  const order = await checkout.getOrder(parsed.data.orderId)
  if (!order) throw new HTTPException(404, { message: "order not found" })
  if (order.status !== "delivered") {
    throw new HTTPException(400, { message: "only delivered orders can be reviewed" })
  }
  const group = await checkout.getOrderGroup(order.orderGroupId)
  const groupEmail = group?.buyerEmail?.toLowerCase() ?? null
  if (!groupEmail || groupEmail !== parsed.data.buyerEmail.toLowerCase()) {
    throw new HTTPException(403, { message: "email does not match this order" })
  }
  const items = await checkout.listOrderItems(order.id)
  const productId = items[0]?.productId
  if (!productId) throw new HTTPException(400, { message: "order has no items" })

  const created = await checkout.createReview({
    orderId: order.id,
    productId,
    sellerId: order.sellerId,
    buyerEmail: parsed.data.buyerEmail.toLowerCase(),
    rating: parsed.data.rating,
    title: parsed.data.title?.trim() ? parsed.data.title.trim() : null,
    body: parsed.data.body.trim(),
  })
  if (!created) throw new HTTPException(409, { message: "this order already has a review" })
  return c.json({ review: publicReview(created) }, 201)
})
