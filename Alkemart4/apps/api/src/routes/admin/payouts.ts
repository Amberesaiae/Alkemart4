import { computePayoutBatch, payableSubtotal, payoutStatusFromTransfer } from "@alkemart/domain"
import {
  PaystackError,
  refundPaystackTransaction,
  verifyPaystackTransfer,
} from "@alkemart/paystack"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type { PayoutHoldRow, PayoutRow } from "../../checkout-repository"
import { autoPayAfter, payOne as payOneShared, sendPayout, type PayOneResult, type PayoutOutcome, type SellerForPayout } from "../../lib/payouts"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"
import { hasVerifiedOwner } from "../../lib/verified-owner"

const CreatePayoutBody = z.object({
  sellerId: z.string().min(1),
})

const RefundBody = z.object({ reference: z.string().min(1).max(100) })


const payoutJson = (p: PayoutRow & { createdAt?: Date | null }) => ({
  id: p.id,
  sellerId: p.sellerId,
  status: p.status,
  grossPesewas: p.grossPesewas.toString(),
  commissionPesewas: p.commissionPesewas.toString(),
  netPesewas: p.netPesewas.toString(),
  commissionBps: p.commissionBps,
  paystackTransferCode: p.paystackTransferCode,
  paystackReference: p.paystackReference,
  failureReason: p.failureReason ?? null,
  paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  createdBy: p.createdBy ?? null,
  createdAt: p.createdAt ? p.createdAt.toISOString() : null,
})

const OUTCOME_TEXT: Record<PayoutOutcome, string> = {
  paid: "Paid — Paystack confirmed the transfer.",
  sent: "Sent — Paystack is processing it. It settles automatically when Paystack confirms.",
  failed: "Paystack refused the transfer. The orders are back in the seller's next payout.",
  unknown: "Paystack didn't answer. Nothing is lost: use Check status — it asks Paystack by reference, and Retry reuses the same reference so money can't be sent twice.",
  otp: "Paystack is waiting for an OTP. Turn off \"Confirm transfers before sending\" in Paystack → Settings → Preferences for automatic payouts.",
}

/** Admin press: pay one seller through the shared path, audit-logged. */
async function payOne(c: Context<AppEnv>, seller: SellerForPayout, secretKey: string, actor: string): Promise<PayOneResult> {
  if (!(await hasVerifiedOwner(c.get("authRepo"), seller.id))) {
    return { kind: "blocked", status: 409, message: "seller owner must verify their email before payout" }
  }
  const r = await payOneShared({ checkout: c.get("checkoutRepo"), secretKey, transfer: c.get("createPaystackTransfer") }, seller, actor)
  if (r.kind === "sent") {
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "payout.trigger",
      targetType: "seller",
      targetId: seller.id,
      detail: { payoutId: r.payout.id, netPesewas: r.payout.netPesewas.toString(), paystackReference: r.payout.paystackReference, outcome: r.outcome },
    })
  }
  return r
}

export const adminPayouts = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? 50) || 50, 200))
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0)
    const [all, sellers] = await Promise.all([
      c.get("checkoutRepo").listRecentPayouts(200).catch(() => []),
      c.get("authRepo").listSellers().catch(() => []),
    ])
    const sellerById = new Map(sellers.map((s) => [s.id, s]))
    const count = all.length
    const page = all.slice(offset, offset + limit)
    return c.json({
      payouts: page.map((p) => ({
        ...payoutJson(p),
        sellerHandle: sellerById.get(p.sellerId)?.handle ?? null,
        sellerName: sellerById.get(p.sellerId)?.name ?? null,
      })),
      count,
    })
  })
  /** Who can be paid now, and who can't (and why) — before anyone presses Pay. */
  .get("/payable", async (c) => {
    const checkout = c.get("checkoutRepo")
    const sellers = await c.get("authRepo").listSellers().catch(() => [])
    const rows = await Promise.all(
      sellers.map(async (s) => {
        const [orders, holds, recent] = await Promise.all([
          checkout.listDeliveredUnpaidOrders(s.id).catch(() => []),
          checkout.listPayoutHolds(s.id, true).catch((): PayoutHoldRow[] => []),
          checkout.listPayoutsForSeller(s.id).catch((): PayoutRow[] => []),
        ])
        const batch = computePayoutBatch(
          s.id,
          s.commissionBps,
          orders.map((o) => ({ orderId: o.id, sellerId: o.sellerId, subtotalPesewas: payableSubtotal(o) })),
        )
        const accountHold = holds.find((h) => !h.orderId)
        const inFlight = recent.find((p) => p.status === "pending" || p.status === "processing")
        const verifiedOwner = await hasVerifiedOwner(c.get("authRepo"), s.id)
        const blocker = s.status !== "open"
          ? "Shop is not approved for payouts"
          : !verifiedOwner
            ? "Shop owner has not verified their email"
            : accountHold
          ? `On hold: ${accountHold.reason}`
          : !s.recipientCode
            ? "No MoMo payout account yet"
            : inFlight
              ? "A payout is already on its way"
              : null
        return {
          sellerId: s.id,
          sellerName: s.name,
          sellerHandle: s.handle,
          orderCount: orders.length,
          grossPesewas: batch.grossPesewas.toString(),
          commissionPesewas: batch.commissionPesewas.toString(),
          netPesewas: batch.netPesewas.toString(),
          heldOrders: holds.filter((h) => h.orderId).length,
          payoutAccount: s.momoPhone ? { provider: s.momoProvider, phoneLast4: s.momoPhone.slice(-4) } : null,
          blocker,
          inFlightPayoutId: inFlight?.id ?? null,
          orders: orders.map((o) => ({ orderId: o.id, orderGroupId: o.orderGroupId, subtotalPesewas: o.subtotalPesewas.toString() })),
        }
      }),
    )
    return c.json({ sellers: rows.filter((r) => r.orderCount > 0 || r.inFlightPayoutId || r.heldOrders > 0) })
  })
  /** Every signed Paystack webhook and what we did with it; alerts first. */
  .get("/paystack-events", async (c) => {
    const events = await c.get("checkoutRepo").listPaystackEvents(200)
    return c.json({
      events: events.map((e) => ({
        ...e,
        amountMinor: e.amountMinor?.toString() ?? null,
        receivedAt: e.receivedAt.toISOString(),
        alert: e.outcome.startsWith("alert:") ? e.outcome.slice(6) : null,
      })),
    })
  })
  /** Refund a buyer who was charged but can't be fulfilled (paid-after-close alert). */
  .post("/refunds", async (c) => {
    const parsed = RefundBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    const checkout = c.get("checkoutRepo")
    const intent = await checkout.getPaymentIntentByReference(parsed.data.reference)
    if (!intent) throw new HTTPException(404, { message: "no checkout with this reference" })
    // Never refund a checkout that became a real order.
    if (await checkout.getOrderGroupByPaymentIntent(intent.id)) {
      throw new HTTPException(409, { message: "this payment has an order — cancel the order instead" })
    }
    const refundFn = c.get("refundPaystackTransaction") ?? refundPaystackTransaction
    try {
      const r = await refundFn({ secretKey }, { reference: parsed.data.reference })
      await checkout.recordPaystackEvent({
        id: `refund.requested:${parsed.data.reference}`,
        event: "refund.requested",
        reference: parsed.data.reference,
        amountMinor: intent.amountPesewas,
        currency: intent.currency,
        status: r.status,
        outcome: "refund",
        detail: `by admin ${c.get("auth").userId}`,
      })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "payment.refund",
        targetType: "payment",
        targetId: intent.id,
        detail: { reference: parsed.data.reference, status: r.status, refundId: r.refundId },
      })
      return c.json({ refund: r })
    } catch (err) {
      throw new HTTPException(502, { message: err instanceof Error ? err.message : "refund failed" })
    }
  })
  .get("/:id", async (c) => {
    const checkout = c.get("checkoutRepo")
    const payout = await checkout.getPayout(c.req.param("id"))
    if (!payout) throw new HTTPException(404, { message: "payout not found" })
    const [lines, events, seller] = await Promise.all([
      checkout.listPayoutLines(payout.id),
      checkout.listPayoutEvents([payout.id]),
      c.get("authRepo").findSellerById(payout.sellerId),
    ])
    return c.json({
      payout: { ...payoutJson(payout), sellerName: seller?.name ?? null, sellerHandle: seller?.handle ?? null },
      lines: lines.map((l) => ({
        orderId: l.orderId,
        grossPesewas: l.grossPesewas.toString(),
        commissionPesewas: l.commissionPesewas.toString(),
        netPesewas: l.netPesewas.toString(),
      })),
      events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    })
  })
  .post("/", async (c) => {
    const parsed = CreatePayoutBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })

    const seller = await c.get("authRepo").findSellerById(parsed.data.sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    const r = await payOne(c, seller, secretKey, `admin:${c.get("auth").userId}`)
    if (r.kind === "replayed") {
      return c.json({ payout: payoutJson(r.payout), replayed: true, message: "A payout for this seller is already on its way — check its status instead." })
    }
    if (r.kind === "blocked") throw new HTTPException(r.status, { message: r.message })
    return c.json({ payout: payoutJson(r.payout), outcome: r.outcome, message: OUTCOME_TEXT[r.outcome] }, r.outcome === "unknown" ? 202 : 200)
  })
  /**
   * "Pay everyone ready": one press sends each seller's released money.
   * Skips sellers on account hold, without a payout account, or with a
   * payout already on its way (payOne never sends twice).
   */
  .post("/run", async (c) => {
    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    const actor = `admin:${c.get("auth").userId}`
    const checkout = c.get("checkoutRepo")
    const sellers = await c.get("authRepo").listSellers().catch(() => [])
    const results: { sellerId: string; sellerName: string; outcome: PayoutOutcome | "skipped"; netPesewas: string | null; message: string }[] = []
    for (const s of sellers) {
      if (!s.recipientCode) continue
      const unpaid = await checkout.listDeliveredUnpaidOrders(s.id).catch(() => [])
      if (unpaid.length === 0) continue
      const holds = await checkout.listPayoutHolds(s.id, true).catch((): PayoutHoldRow[] => [])
      if (holds.some((h) => !h.orderId)) continue
      const r = await payOne(c, s, secretKey, actor)
      if (r.kind === "sent") {
        results.push({ sellerId: s.id, sellerName: s.name, outcome: r.outcome, netPesewas: r.payout.netPesewas.toString(), message: OUTCOME_TEXT[r.outcome] })
      } else if (r.kind === "blocked" && r.status === 409) {
        results.push({ sellerId: s.id, sellerName: s.name, outcome: "skipped", netPesewas: null, message: r.message })
      }
    }
    return c.json({ results })
  })
  /** Ask Paystack what happened to this payout (by its reference) and record it. */
  .post("/:id/check", async (c) => {
    const checkout = c.get("checkoutRepo")
    const payout = await checkout.getPayout(c.req.param("id"))
    if (!payout?.paystackReference) throw new HTTPException(404, { message: "payout not found" })
    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    const actor = `admin:${c.get("auth").userId}`
    const verify = c.get("verifyPaystackTransfer") ?? verifyPaystackTransfer
    try {
      const v = await verify({ secretKey }, payout.paystackReference)
      const to = payoutStatusFromTransfer(v.status)
      await checkout.addPayoutEvent(payout.id, "checked", actor, `Paystack says: ${v.status}`)
      if (to === "paid" || to === "failed" || to === "reversed") {
        if (to === "paid" && payout.status === "pending") await checkout.markPayoutSent(payout.id, v.transferCode, actor)
        await checkout.settlePayout(payout.id, to, { actor: "paystack", reason: to === "paid" ? null : (v.reason ?? `Paystack: ${v.status}`), transferCode: v.transferCode })
        if (to === "paid") await autoPayAfter(c, payout.sellerId)
      } else if (to === "processing") {
        await checkout.markPayoutSent(payout.id, v.transferCode, actor)
      }
      const fresh = (await checkout.getPayout(payout.id)) ?? payout
      return c.json({ payout: payoutJson(fresh), paystackStatus: v.status })
    } catch (err) {
      if (err instanceof PaystackError && err.definite && payout.status === "pending") {
        // Paystack has no transfer with this reference: it never arrived. Safe to retry.
        await checkout.addPayoutEvent(payout.id, "checked", actor, "Paystack has no record of this transfer — safe to retry")
        return c.json({ payout: payoutJson(payout), paystackStatus: "not_found", message: "Paystack never received this transfer. Retry is safe (same reference)." })
      }
      throw new HTTPException(502, { message: err instanceof Error ? err.message : "Paystack check failed" })
    }
  })
  /** Re-send a payout Paystack never confirmed — with the SAME reference. */
  .post("/:id/retry", async (c) => {
    const checkout = c.get("checkoutRepo")
    const payout = await checkout.getPayout(c.req.param("id"))
    if (!payout) throw new HTTPException(404, { message: "payout not found" })
    if (payout.status !== "pending") {
      throw new HTTPException(409, { message: `only a payout Paystack never confirmed can be retried (this one is ${payout.status})` })
    }
    const seller = await c.get("authRepo").findSellerById(payout.sellerId)
    if (!seller?.recipientCode) throw new HTTPException(400, { message: "seller missing Paystack recipient_code" })
    if (seller.status !== "open" || !(await hasVerifiedOwner(c.get("authRepo"), seller.id))) {
      throw new HTTPException(409, { message: "seller must be open with a verified owner before retrying a payout" })
    }
    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    const actor = `admin:${c.get("auth").userId}`
    await checkout.addPayoutEvent(payout.id, "retried", actor, `same reference ${payout.paystackReference}`)
    const r = await sendPayout({ checkout, secretKey, transfer: c.get("createPaystackTransfer") }, payout, seller.recipientCode, seller.handle, actor)
    return c.json({ payout: payoutJson(r.payout), outcome: r.outcome, message: OUTCOME_TEXT[r.outcome] }, r.outcome === "unknown" ? 202 : 200)
  })

const HoldBody = z.object({
  sellerId: z.string().min(1),
  orderId: z.string().min(1).optional().nullable(),
  amountPesewas: z.string().regex(/^\d+$/).optional().nullable(),
  reason: z.string().trim().min(1).max(1000),
})

/**
 * Phase 4D — payout holds. An order-level hold freezes one order's net; a
 * hold without orderId freezes the seller's whole pending balance (account
 * review). Every hold and release names its actor in the audit log.
 */
export const adminPayoutHolds = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const sellerId = c.req.query("seller_id")?.trim()
    if (!sellerId) throw new HTTPException(400, { message: "seller_id required" })
    const all = c.req.query("all") === "1"
    const holds = await c.get("checkoutRepo").listPayoutHolds(sellerId, !all)
    return c.json({
      holds: holds.map((h) => ({
        id: h.id,
        sellerId: h.sellerId,
        orderId: h.orderId,
        amountPesewas: h.amountPesewas?.toString() ?? null,
        reason: h.reason,
        status: h.status,
        createdBy: h.createdBy,
        releasedBy: h.releasedBy,
        releasedAt: h.releasedAt ? h.releasedAt.toISOString() : null,
        createdAt: h.createdAt.toISOString(),
      })),
    })
  })
  .post("/", async (c) => {
    const parsed = HoldBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const seller = await c.get("authRepo").findSellerById(parsed.data.sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    try {
      const hold = await c.get("checkoutRepo").createPayoutHold({
        sellerId: seller.id,
        orderId: parsed.data.orderId ?? null,
        amountPesewas:
          parsed.data.amountPesewas !== undefined && parsed.data.amountPesewas !== null
            ? BigInt(parsed.data.amountPesewas)
            : null,
        reason: parsed.data.reason,
        createdBy: c.get("auth").userId,
      })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "payout.hold",
        targetType: "seller",
        targetId: seller.id,
        detail: { holdId: hold.id, orderId: hold.orderId, reason: hold.reason },
      })
      return c.json({
        hold: {
          id: hold.id,
          sellerId: hold.sellerId,
          orderId: hold.orderId,
          amountPesewas: hold.amountPesewas?.toString() ?? null,
          reason: hold.reason,
          status: hold.status,
          createdAt: hold.createdAt.toISOString(),
        },
      }, 201)
    } catch (err) {
      if (err instanceof HTTPException) throw err
      throw new HTTPException(400, { message: err instanceof Error ? err.message : "invalid hold" })
    }
  })
  .post("/:id/release", async (c) => {
    const hold = await c.get("checkoutRepo").releasePayoutHold(c.req.param("id"), c.get("auth").userId)
    if (!hold) throw new HTTPException(404, { message: "hold not found" })
    await autoPayAfter(c, hold.sellerId)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "payout.unhold",
      targetType: "seller",
      targetId: hold.sellerId,
      detail: { holdId: hold.id, orderId: hold.orderId },
    })
    return c.json({ hold: { id: hold.id, status: hold.status } })
  })
