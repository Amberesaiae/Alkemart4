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
