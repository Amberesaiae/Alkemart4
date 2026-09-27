import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { publicVideo } from "../../lib/videos"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"
import type { VideoStatus } from "../../videos-store"

/** Approve product video links before buyers see them; feature the best in "Watch & shop". Audit-logged. */
const RejectBody = z.object({ reason: z.string().trim().min(3).max(300) })

export const adminVideos = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const status = (["pending", "approved", "rejected"] as const).find((s) => s === c.req.query("status")) ?? "pending"
    const rows = await c.get("videos").listVideos({ statuses: [status as VideoStatus] })
    const cards = await c.get("repo").productCardsByIds([...new Set(rows.map((v) => v.productId))]).catch(() => new Map())
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    const pending = (await c.get("videos").listVideos({ statuses: ["pending"] })).length
    return c.json({
      pending,
      items: rows.map((v) => ({ ...publicVideo(v), productTitle: cards.get(v.productId)?.title ?? null, sellerName: sellers.get(v.sellerId) ?? null })),
    })
  })
  .post("/:id/:action{approve|reject|feature|unfeature}", async (c) => {
    const action = c.req.param("action")
    let reason: string | null = null
    if (action === "reject") {
      const parsed = RejectBody.safeParse(await readJsonBody(c).catch(() => ({})))
      if (!parsed.success) throw new HTTPException(400, { message: "Tell the seller why in a few words." })
      reason = parsed.data.reason
    }
    const patch =
      action === "approve" ? { status: "approved" as const, rejectReason: null } : action === "reject" ? { status: "rejected" as const, rejectReason: reason } : { featured: action === "feature" }
    const v = await c.get("videos").decideVideo(c.req.param("id"), patch)
    if (!v) throw new HTTPException(404, { message: "video not found" })
    if (action === "feature" && !v.featured) throw new HTTPException(409, { message: "Approve the video before featuring it." })
    await c.get("auditLog").log({ adminUserId: c.get("auth").userId, action: `videos.${action}`, targetType: "product_video", targetId: v.id, detail: { productId: v.productId, reason } })
    return c.json({ video: publicVideo(v) })
  })
