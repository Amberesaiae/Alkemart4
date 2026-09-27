import { orderReference } from "@alkemart/shared/order-ref"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { OPEN_RETURN_STATUSES } from "@alkemart/domain"
import type { AppEnv } from "../../context"
import type { ReturnCaseRow } from "../../checkout-repository"
import {
  applyReturnAction,
  clockOf,
  loadOrderContext,
  publicReturnCase,
  returnDeps,
  returnPolicy,
  sendProviderRefund,
  sweepDueReturns,
} from "../../lib/returns"
import { orderEmailLinks } from "../../lib/order-emails"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

/**
 * Admin decides only what buyer and seller couldn't settle (escalated cases),
 * and sees refunds that need a hand (failed at the provider, or still owed
 * by a pay-on-delivery seller). Every decision is audit-logged.
 */
const VIEWS = ["decide", "open", "refunds", "closed"] as const
type View = (typeof VIEWS)[number]

const DecideBody = z.object({
  outcome: z.enum(["refund", "declined"]),
  note: z.string().trim().min(1).max(1000),
})

const inView = (r: ReturnCaseRow, v: View) =>
  v === "decide"
    ? r.status === "escalated"
    : v === "open"
      ? OPEN_RETURN_STATUSES.includes(r.status)
      : v === "refunds"
        ? r.refundStatus === "failed" || r.refundStatus === "owed"
        : r.status === "closed"

async function sweep(c: Context<AppEnv>) {
  await sweepDueReturns({ checkout: c.get("checkoutRepo"), policy: await returnPolicy(c), links: orderEmailLinks(c) }).catch(() => 0)
}

async function detail(c: Context<AppEnv>, row: ReturnCaseRow) {
  const checkout = c.get("checkoutRepo")
  const ctx = await loadOrderContext(checkout, row.orderId)
  const seller = await c.get("authRepo").findSellerById(row.sellerId).catch(() => null)
  const items = ctx ? await checkout.listOrderItems(ctx.order.id).catch(() => []) : []
  return {
    ...publicReturnCase(row, "admin", { paidOut: !!ctx?.order.payoutId, payOnDelivery: ctx?.intent?.method === "cod" }),
    sellerName: seller?.name ?? null,
    order: ctx
      ? {
          id: ctx.order.id,
          orderGroupId: ctx.group.id,
          reference: orderReference(ctx.group.id),
          status: ctx.order.status,
          placedAt: ctx.placedAt?.toISOString() ?? null,
          deliveredAt: ctx.deliveredAt?.toISOString() ?? null,
          deliveryConfirmedBy: ctx.order.deliveryConfirmedBy ?? null,
          fulfillmentMethod: ctx.order.fulfillmentMethod ?? "delivery",
          paymentMethod: ctx.intent?.method ?? null,
          subtotalPesewas: ctx.order.subtotalPesewas.toString(),
          deliveryFeePesewas: ctx.order.deliveryFeePesewas.toString(),
          refundedPesewas: (ctx.order.refundedPesewas ?? 0n).toString(),
          paidOut: !!ctx.order.payoutId,
          items: items.map((i) => ({ title: i.title, qty: i.qty, unitPricePesewas: i.unitPricePesewas.toString() })),
        }
      : null,
  }
}

export const adminReturns = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    await sweep(c)
    const view = (VIEWS as readonly string[]).includes(c.req.query("view") ?? "") ? (c.req.query("view") as View) : "decide"
    const checkout = c.get("checkoutRepo")
    const all = await checkout.listReturnCases({})
    const rows = all.filter((r) => inView(r, view)).slice(0, 200)
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    const refs = new Map(
      await Promise.all([...new Set(rows.map((r) => r.orderId))].map(async (id) => [id, (await checkout.getOrder(id))?.orderGroupId ?? null] as const)),
    )
    return c.json({
      view,
      counts: Object.fromEntries(VIEWS.map((v) => [v, all.filter((r) => inView(r, v)).length])),
      items: rows.map((r) => ({
        ...publicReturnCase(r, "admin"),
        sellerName: sellers.get(r.sellerId) ?? null,
        orderReference: refs.get(r.orderId) ? orderReference(refs.get(r.orderId)!) : null,
      })),
      now: clockOf(checkout).toISOString(),
    })
  })
  .get("/:id", async (c) => {
    await sweep(c)
    const row = await c.get("checkoutRepo").getReturnCase(c.req.param("id"))
    if (!row) throw new HTTPException(404, { message: "return not found" })
    return c.json({ returnCase: await detail(c, row) })
  })
  .post("/:id/decide", async (c) => {
    const parsed = DecideBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Pick a decision and write a short reason." })
    const row = await c.get("checkoutRepo").getReturnCase(c.req.param("id"))
    if (!row) throw new HTTPException(404, { message: "return not found" })
    const { outcome, note } = parsed.data
    const next = await applyReturnAction(returnDeps(c, await returnPolicy(c)), row, {
      by: "admin",
      type: "decide",
      outcome,
      note,
    })
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "returns.decide",
      targetType: "return_case",
      targetId: row.id,
      detail: { orderId: row.orderId, outcome, amountPesewas: next.refundPesewas.toString(), note },
    })
    return c.json({ returnCase: await detail(c, next) })
  })
  /** Send a refund again after the provider refused or failed it. */
  .post("/:id/retry-refund", async (c) => {
    const row = await c.get("checkoutRepo").getReturnCase(c.req.param("id"))
    if (!row) throw new HTTPException(404, { message: "return not found" })
    if (row.refundVia !== "provider" || row.refundStatus !== "failed") throw new HTTPException(409, { message: "This refund isn't waiting for a retry." })
    const next = (await sendProviderRefund(returnDeps(c, await returnPolicy(c)), row)) ?? row
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "returns.retry_refund",
      targetType: "return_case",
      targetId: row.id,
      detail: { orderId: row.orderId, status: next.refundStatus },
    })
    return c.json({ returnCase: await detail(c, next) })
  })
