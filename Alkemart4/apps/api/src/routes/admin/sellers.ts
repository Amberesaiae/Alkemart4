import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AuthSeller } from "../../auth-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const CommissionBody = z.object({
  commissionBps: z.number().int().min(0).max(10_000),
})

function publicSeller(seller: AuthSeller) {
  return {
    id: seller.id,
    handle: seller.handle,
    name: seller.name,
    status: seller.status,
    commissionBps: seller.commissionBps,
  }
}

export const adminSellers = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const sellers = await c.get("authRepo").listSellers()
    return c.json({ items: sellers.map(publicSeller) })
  })
  .post("/:id/approve", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "open")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/suspend", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "suspended")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/unsuspend", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "open")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/terminate", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "terminated")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/commission", async (c) => {
    const parsed = CommissionBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const seller = await c.get("authRepo").updateSellerCommission(
      c.req.param("id"),
      parsed.data.commissionBps,
    )
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json({ seller: publicSeller(seller) })
  })
