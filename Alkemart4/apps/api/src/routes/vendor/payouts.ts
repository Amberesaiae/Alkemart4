import { computePayoutBatch } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"

function sellerIdOrThrow(c: { get(k: "auth"): AppEnv["Variables"]["auth"] }): string {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

/**
 * Phase 4D — seller money statement (CSV/PDF-ready JSON).
 * Delivered orders only (money truth): each line carries gross/commission/
 * net in pesewas plus its state — paid (batch ref), held (reason), or
 * pending. Commission math reuses the domain batch function, so the
 * statement can never disagree with the payout ledger.
 */
export const vendorPayouts = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/statement", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const checkout = c.get("checkoutRepo")
    const [orders, paidLines, holds] = await Promise.all([
      checkout.listOrdersForSeller(sellerId),
      checkout.listPaidLinesForSeller(sellerId).catch(() => []),
      checkout.listPayoutHolds(sellerId, true).catch(() => []),
    ])
    const delivered = orders.filter((o) => o.status === "delivered")
    const paidByOrder = new Map(paidLines.map((l) => [l.orderId, l]))
    const holdByOrder = new Map<string, { reason: string; amountPesewas: string | null }>()
    const sellerLevelHolds: { reason: string }[] = []
    for (const h of holds) {
      if (h.orderId) holdByOrder.set(h.orderId, {
        reason: h.reason,
        amountPesewas: h.amountPesewas?.toString() ?? null,
      })
      else sellerLevelHolds.push({ reason: h.reason })
    }
    const unpaid = delivered.filter((o) => !paidByOrder.has(o.id))
    const batch = computePayoutBatch(
      sellerId,
      seller.commissionBps,
      unpaid.map((o) => ({ orderId: o.id, sellerId: o.sellerId, subtotalPesewas: o.subtotalPesewas })),
    )
    const computedByOrder = new Map(batch.lines.map((l) => [l.orderId, l]))
    // Order dates ride the buyer-facing group (orders carry no clock).
    const groupDates = new Map<string, string>()
    await Promise.all(
      [...new Set(delivered.map((o) => o.orderGroupId))].map(async (gid) => {
        const group = await checkout.getOrderGroup(gid).catch(() => null)
        const at = (group as { createdAt?: Date } | null)?.createdAt
        if (at) groupDates.set(gid, at.toISOString())
      }),
    )
    const lines = delivered.map((o) => {
      const paid = paidByOrder.get(o.id)
      const computed = computedByOrder.get(o.id)
      const hold = holdByOrder.get(o.id)
      const sellerHold = sellerLevelHolds[0] ?? null
      const state = paid ? "paid" : hold || sellerHold ? "held" : "pending"
      return {
        orderId: o.id,
        orderGroupId: o.orderGroupId,
        orderedAt: groupDates.get(o.orderGroupId) ?? null,
        status: o.status,
        state,
        subtotalPesewas: o.subtotalPesewas.toString(),
        commissionPesewas: (paid?.commissionPesewas ?? computed?.commissionPesewas ?? 0n).toString(),
        netPesewas: (paid?.netPesewas ?? computed?.netPesewas ?? o.subtotalPesewas).toString(),
        holdReason: hold?.reason ?? sellerHold?.reason ?? null,
        payoutId: paid?.payoutId ?? null,
        payoutStatus: paid?.payoutStatus ?? null,
        paidAt: paid?.paidAt ? paid.paidAt.toISOString() : null,
      }
    })
    const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n)
    const pending = lines.filter((l) => l.state === "pending")
    const held = lines.filter((l) => l.state === "held")
    const paidSt = lines.filter((l) => l.state === "paid")
    return c.json({
      sellerId,
      commissionBps: seller.commissionBps,
      currency: "ghs",
      totals: {
        pendingGrossPesewas: sum(pending.map((l) => BigInt(l.subtotalPesewas))).toString(),
        pendingNetPesewas: sum(pending.map((l) => BigInt(l.netPesewas))).toString(),
        heldNetPesewas: sum(held.map((l) => BigInt(l.netPesewas))).toString(),
        paidNetPesewas: sum(paidSt.map((l) => BigInt(l.netPesewas))).toString(),
        lineCount: lines.length,
      },
      holds: holds.map((h) => ({
        id: h.id,
        orderId: h.orderId,
        amountPesewas: h.amountPesewas?.toString() ?? null,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
      lines,
    })
  })
