import { computePayoutBatch, payableSubtotal, payoutStatusText } from "@alkemart/domain"
import { marketCurrency } from "@alkemart/shared/markets"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { PayoutEventRow, ReturnCaseRow } from "../../checkout-repository"
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
    // This is a read-only statement. Payment execution belongs to the
    // release workflow, never a page view controlled by a seller session.
    const checkout = c.get("checkoutRepo")
    const [orders, paidLines, holds, payoutRows] = await Promise.all([
      checkout.listSellerOrderSummaries(sellerId),
      checkout.listPaidLinesForSeller(sellerId).catch((): Awaited<ReturnType<typeof checkout.listPaidLinesForSeller>> => []),
      checkout.listPayoutHolds(sellerId, true).catch(() => []),
      checkout.listPayoutsForSeller(sellerId).catch((): Awaited<ReturnType<typeof checkout.listPayoutsForSeller>> => []),
    ])
    const payoutEvents = await checkout.listPayoutEvents(payoutRows.map((p) => p.id)).catch((): PayoutEventRow[] => [])
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
    // COD settlement rule: the seller's rider holds pay-on-delivery cash, so
    // those orders are never payable — the seller owes the commission.
    const isCash = (o: { paymentMethod: string | null }) => o.paymentMethod === "cod"
    const commissionOn = (subtotal: bigint) => (subtotal * BigInt(seller.commissionBps)) / 10_000n
    const unpaid = delivered.filter((o) => !paidByOrder.has(o.id) && !isCash(o))
    const batch = computePayoutBatch(
      sellerId,
      seller.commissionBps,
      unpaid.map((o) => ({ orderId: o.id, sellerId: o.sellerId, subtotalPesewas: payableSubtotal(o) })),
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
      const cash = isCash(o) && !paid
      // Refunded in full before it was paid out: nothing is coming for it.
      const refunded = !paid && !cash && (o.refundedPesewas ?? 0n) > 0n && (o.refundedPesewas ?? 0n) >= o.subtotalPesewas
      // In a payout Paystack hasn't confirmed yet → "sending", not "paid".
      const state = paid
        ? paid.payoutStatus === "paid"
          ? "paid"
          : "sending"
        : cash
          ? "cash"
          : refunded
            ? "refunded"
            : hold || sellerHold
              ? "held"
              : "pending"
      return {
        orderId: o.id,
        orderGroupId: o.orderGroupId,
        orderedAt: groupDates.get(o.orderGroupId) ?? null,
        status: o.status,
        state,
        subtotalPesewas: o.subtotalPesewas.toString(),
        paymentMethod: o.paymentMethod,
        commissionPesewas: (paid?.commissionPesewas ?? computed?.commissionPesewas ?? (cash ? commissionOn(payableSubtotal(o)) : 0n)).toString(),
        // Refunded to the buyer on a return (0044): not paid out, no commission.
        refundedPesewas: (o.refundedPesewas ?? 0n).toString(),
        // What alkemart pays the seller for this order: nothing for cash orders.
        netPesewas: (cash || refunded ? 0n : (paid?.netPesewas ?? computed?.netPesewas ?? o.subtotalPesewas)).toString(),
        cashCollectedPesewas: cash ? (o.subtotalPesewas + o.deliveryFeePesewas).toString() : null,
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
    const sendingSt = lines.filter((l) => l.state === "sending")
    const cashSt = lines.filter((l) => l.state === "cash")
    return c.json({
      sellerId,
      commissionBps: seller.commissionBps,
      // Display currency for single-market today; ledger rows resolve per order.
      currency: marketCurrency(),
      totals: {
        // Gross less anything refunded, so it lines up with pendingNet.
        pendingGrossPesewas: sum(pending.map((l) => BigInt(l.subtotalPesewas) - BigInt(l.refundedPesewas))).toString(),
        pendingNetPesewas: sum(pending.map((l) => BigInt(l.netPesewas))).toString(),
        heldNetPesewas: sum(held.map((l) => BigInt(l.netPesewas))).toString(),
        paidNetPesewas: sum(paidSt.map((l) => BigInt(l.netPesewas))).toString(),
        sendingNetPesewas: sum(sendingSt.map((l) => BigInt(l.netPesewas))).toString(),
        cashCollectedPesewas: sum(cashSt.map((l) => BigInt(l.cashCollectedPesewas ?? "0"))).toString(),
        commissionOwedPesewas: sum(cashSt.map((l) => BigInt(l.commissionPesewas))).toString(),
        // Refunds on orders you were already paid for, taken from your next payout.
        refundsToRecoverPesewas: sum(
          (await checkout.listReturnCases({ sellerId }).catch((): ReturnCaseRow[] => []))
            .filter((r) => r.sellerRecoveryPesewas > 0n && !r.recoveredPayoutId && r.refundStatus !== "failed")
            .map((r) => r.sellerRecoveryPesewas),
        ).toString(),
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
      // Where the money goes (masked) — sellers should always know.
      payoutAccount: seller.momoPhone
        ? { type: "momo", provider: seller.momoProvider, phoneLast4: seller.momoPhone.slice(-4) }
        : null,
      // Every payout with its steps, in plain words. Admin identities stay private.
      payouts: payoutRows.map((p) => ({
        id: p.id,
        status: p.status,
        statusText: payoutStatusText(p.status),
        grossPesewas: p.grossPesewas.toString(),
        commissionPesewas: p.commissionPesewas.toString(),
        netPesewas: p.netPesewas.toString(),
        // Refunds on already-paid orders taken back from this payout.
        recoveredPesewas: (p.recoveredPesewas ?? 0n).toString(),
        reference: p.paystackReference,
        failureReason: p.failureReason ?? null,
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        orderCount: paidLines.filter((l) => l.payoutId === p.id).length,
        steps: payoutEvents
          .filter((e) => e.payoutId === p.id && e.status !== "checked" && e.status !== "retried")
          .map((e) => ({
            status: e.status,
            by: e.actor === "paystack" ? "Paystack" : "alkemart",
            at: e.createdAt.toISOString(),
            detail: e.status === "failed" || e.status === "reversed" ? e.detail : null,
          })),
      })),
    })
  })
