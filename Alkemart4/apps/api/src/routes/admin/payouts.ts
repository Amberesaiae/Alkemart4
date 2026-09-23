import { computePayoutBatch } from "@alkemart/domain"
import { createPaystackTransfer } from "@alkemart/paystack"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const CreatePayoutBody = z.object({
  sellerId: z.string().min(1),
})

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
        id: p.id,
        sellerId: p.sellerId,
        sellerHandle: sellerById.get(p.sellerId)?.handle ?? null,
        sellerName: sellerById.get(p.sellerId)?.name ?? null,
        status: p.status,
        grossPesewas: p.grossPesewas.toString(),
        commissionPesewas: p.commissionPesewas.toString(),
        netPesewas: p.netPesewas.toString(),
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      })),
      count,
    })
  })
  .post("/", async (c) => {
    const parsed = CreatePayoutBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })

    const seller = await c.get("authRepo").findSellerById(parsed.data.sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    if (!seller.recipientCode) {
      throw new HTTPException(400, { message: "seller missing Paystack recipient_code" })
    }

    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) {
      throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    }

    const checkout = c.get("checkoutRepo")
    const unpaid = await checkout.listDeliveredUnpaidOrders(seller.id)
    if (unpaid.length === 0) {
      throw new HTTPException(400, { message: "no delivered unpaid orders" })
    }

    const reference = `payout_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
    const batch = computePayoutBatch(
      seller.id,
      seller.commissionBps,
      unpaid.map((o) => ({
        orderId: o.id,
        sellerId: o.sellerId,
        subtotalPesewas: o.subtotalPesewas,
      })),
    )

    const transferFn = c.get("createPaystackTransfer") ?? createPaystackTransfer
    let transfer: { transferCode: string; reference: string; status: string }
    try {
      transfer = await transferFn(
        { secretKey },
        {
          amountPesewas: batch.netPesewas,
          recipientCode: seller.recipientCode,
          reference,
          reason: `Alkemart payout ${seller.handle}`,
        },
      )
    } catch (err) {
      throw new HTTPException(502, {
        message: err instanceof Error ? err.message : "Paystack transfer failed",
      })
    }

    // Transfer first (money truth), ledger second. If the ledger write fails
    // after the transfer succeeded, say so explicitly with the reference —
    // ops can reconcile instead of silently double-paying on retry.
    try {
      const payout = await checkout.createPayout({
        sellerId: seller.id,
        commissionBps: seller.commissionBps,
        paystackTransferCode: transfer.transferCode,
        paystackReference: transfer.reference,
      })

      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "payout.trigger",
        targetType: "seller",
        targetId: seller.id,
        detail: {
          payoutId: payout.id,
          netPesewas: payout.netPesewas.toString(),
          paystackReference: payout.paystackReference,
        },
      })

      return c.json({
        payout: {
          id: payout.id,
          sellerId: payout.sellerId,
          status: payout.status,
          grossPesewas: payout.grossPesewas.toString(),
          commissionPesewas: payout.commissionPesewas.toString(),
          netPesewas: payout.netPesewas.toString(),
          commissionBps: payout.commissionBps,
          paystackTransferCode: payout.paystackTransferCode,
          paystackReference: payout.paystackReference,
        },
      })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      throw new HTTPException(502, {
        message: `Transfer ${transfer.reference} may have succeeded but payout ledger write failed: ${
          err instanceof Error ? err.message : "unknown error"
        }. Do not retry until reconciled.`,
      })
    }
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
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "payout.unhold",
      targetType: "seller",
      targetId: hold.sellerId,
      detail: { holdId: hold.id, orderId: hold.orderId },
    })
    return c.json({ hold: { id: hold.id, status: hold.status } })
  })
