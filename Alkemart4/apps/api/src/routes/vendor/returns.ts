import { orderReference } from "@alkemart/shared/order-ref"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { OPEN_RETURN_STATUSES, type ReturnAction } from "@alkemart/domain"
import type { AppEnv } from "../../context"
import type { ReturnCaseRow } from "../../checkout-repository"
import { applyReturnAction, clockOf, publicReturnCase, returnDeps, returnPolicy, sweepDueReturns } from "../../lib/returns"
import { orderEmailLinks } from "../../lib/order-emails"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

/**
 * The seller's side of returns: refund in full, send a replacement, or
 * decline with a reason. Admin only sees cases the two couldn't settle.
 */
const DeclineBody = z.object({ reason: z.string().trim().min(1).max(500) })

async function mine(c: Context<AppEnv>): Promise<ReturnCaseRow> {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  const row = await c.get("checkoutRepo").getReturnCase(c.req.param("id") ?? "")
  if (!row || row.sellerId !== sellerId) throw new HTTPException(404, { message: "return not found" })
  return row
}

async function act(c: Context<AppEnv>, action: ReturnAction) {
  const policy = await returnPolicy(c)
  await sweepDueReturns({ checkout: c.get("checkoutRepo"), policy, links: orderEmailLinks(c) }).catch(() => 0)
  const row = await mine(c)
  const next = await applyReturnAction(returnDeps(c, policy), row, action)
  return c.json({ returnCase: publicReturnCase(next, "seller") })
}

export const vendorReturns = new Hono<AppEnv>()
  .use("*", requireSeller)
  /** Open cases first (the ones waiting on you at the top), then the last closed ones. */
  .get("/", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const checkout = c.get("checkoutRepo")
    await sweepDueReturns({ checkout, policy: await returnPolicy(c), links: orderEmailLinks(c) }).catch(() => 0)
    const rows = await checkout.listReturnCases({ sellerId })
    const orders = new Map(await Promise.all([...new Set(rows.map((r) => r.orderId))].map(async (id) => [id, await checkout.getOrder(id)] as const)))
    const rank = (r: ReturnCaseRow) => (r.status === "requested" ? 0 : OPEN_RETURN_STATUSES.includes(r.status) ? 1 : 2)
    const items = rows
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 200)
      .map((r) => {
        const o = orders.get(r.orderId)
        return { ...publicReturnCase(r, "seller"), orderReference: o ? orderReference(o.orderGroupId) : null, subtotalPesewas: o?.subtotalPesewas.toString() ?? null }
      })
    return c.json({ items, waitingOnYou: rows.filter((r) => r.status === "requested").length, now: clockOf(checkout).toISOString() })
  })
  .post("/:id/refund", (c) => act(c, { by: "seller", type: "refund" }))
  .post("/:id/replace", (c) => act(c, { by: "seller", type: "replace" }))
  .post("/:id/decline", async (c) => {
    const parsed = DeclineBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Tell the buyer why in a few words." })
    return act(c, { by: "seller", type: "decline", reason: parsed.data.reason })
  })
  /** Pay on delivery: the seller paid the buyer back themselves. */
  .post("/:id/refund-paid", async (c) => {
    const row = await mine(c)
    if (row.refundVia !== "seller" || row.refundStatus !== "owed") throw new HTTPException(409, { message: "There's no refund for you to pay on this return." })
    const next = await c.get("checkoutRepo").setReturnRefund(row.id, { status: "paid", entry: { by: "seller", note: "Seller paid the buyer back" } })
    return c.json({ returnCase: publicReturnCase(next ?? row, "seller") })
  })
