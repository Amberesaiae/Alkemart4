import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const ResolveBody = z.object({
  decision: z.enum(["reopen", "uphold"]),
  note: z.string().trim().max(1000).optional().nullable(),
})

/** GET /admin/appeals — open seller appeals with product + seller context. */
export const adminAppeals = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const [appeals, products, sellers] = await Promise.all([
      c.get("appeals").listOpen(),
      c.get("repo").listAdminProducts().catch(() => []),
      c.get("authRepo").listSellers(),
    ])
    const productById = new Map(products.map((p) => [p.id, p]))
    const sellerById = new Map(sellers.map((s) => [s.id, s]))
    return c.json({
      appeals: appeals.map((a) => ({
        ...a,
        product: (() => {
          const p = productById.get(a.productId)
          return p ? { id: p.id, title: p.title, status: p.status, imageUrl: p.imageUrl } : null
        })(),
        seller: (() => {
          const s = sellerById.get(a.sellerId)
          return s ? { id: s.id, name: s.name, handle: s.handle } : null
        })(),
      })),
    })
  })
  .post("/:id/resolve", async (c) => {
    const parsed = ResolveBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const open = await c.get("appeals").listOpen()
    const appeal = open.find((a) => a.id === c.req.param("id"))
    if (!appeal) throw new HTTPException(404, { message: "appeal not found" })

    if (parsed.data.decision === "reopen") {
      const updated = await c.get("repo").proposeVendorProduct(appeal.sellerId, appeal.productId)
      if (!updated) throw new HTTPException(404, { message: "product not found" })
    }
    const closed = await c.get("appeals").resolve(
      appeal.id,
      parsed.data.decision === "reopen" ? "reopened" : "upheld",
      parsed.data.note ?? null,
    )
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: parsed.data.decision === "reopen" ? "appeal.reopened" : "appeal.upheld",
      targetType: "appeal",
      targetId: appeal.id,
      detail: { productId: appeal.productId, note: parsed.data.note ?? undefined },
    })
    return c.json({ appeal: closed })
  })
