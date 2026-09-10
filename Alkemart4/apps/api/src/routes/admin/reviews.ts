import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const ModerateBody = z.object({
  action: z.enum(["publish", "hide"]),
})

/** GET /admin/reviews — pending-first moderation inbox. */
export const adminReviews = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const [pending, sellers] = await Promise.all([
      c.get("checkoutRepo").listPendingReviews(),
      c.get("authRepo").listSellers().catch(() => []),
    ])
    const sellerById = new Map(sellers.map((s) => [s.id, s]))
    return c.json({
      reviews: pending.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        productId: r.productId,
        buyerEmail: r.buyerEmail,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        seller: (() => {
          const s = sellerById.get(r.sellerId)
          return s ? { id: s.id, name: s.name, handle: s.handle } : null
        })(),
      })),
    })
  })
  .post("/:id/moderate", async (c) => {
    const parsed = ModerateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const updated = await c
      .get("checkoutRepo")
      .updateReviewStatus(c.req.param("id"), parsed.data.action === "publish" ? "published" : "hidden")
    if (!updated) throw new HTTPException(404, { message: "review not found" })
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: `review.${parsed.data.action}`,
      targetType: "review",
      targetId: updated.id,
      detail: { productId: updated.productId, sellerId: updated.sellerId },
    })
    return c.json({ review: { id: updated.id, status: updated.status } })
  })
