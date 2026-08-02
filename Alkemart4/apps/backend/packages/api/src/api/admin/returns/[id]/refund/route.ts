/**
 * POST /admin/returns/:id/refund
 *
 * Initiate a Paystack refund for a received return.
 * Requires:
 *   - return.status === "received"
 *   - A captured payment with a Paystack reference in payment.data.reference
 *
 * Body: { amount_ghs?: number } — partial refund amount in GHS (major units).
 *   If omitted, refunds the full return.refund_amount.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils"
import { refundCharge, toPaystackAmountPesewas } from "../../../../../lib/paystack-client"
import { writeAuditLog } from "../../../../../lib/audit-log"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const returnId = req.params.id
  if (!returnId) {
    res.status(400).json({ error: "Return id required." })
    return
  }

  const body = req.body as { amount_ghs?: number } | undefined

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "return",
      fields: [
        "id", "status", "refund_amount", "order_id", "metadata",
        "order.currency_code",
        "order.payment_collections.payments.id",
        "order.payment_collections.payments.status",
        "order.payment_collections.payments.amount",
        "order.payment_collections.payments.data",
      ],
      filters: { id: returnId },
    })
    const ret = asList(data)[0] as {
      id: string
      status: string
      refund_amount?: number
      order_id: string
      metadata?: Record<string, unknown>
      order?: {
        currency_code?: string
        payment_collections?: { payments?: { id: string; status: string; amount: number; data?: Record<string, unknown> }[] }[]
      }
    } | undefined

    if (!ret) {
      res.status(404).json({ error: "Return not found." })
      return
    }
    if (ret.status !== "received") {
      res.status(409).json({ error: `Refunds are only allowed for received returns. Current status: ${ret.status}` })
      return
    }
    if (ret.metadata?.refunded_at) {
      res.status(409).json({ error: "This return has already been refunded." })
      return
    }

    const payment = ret.order?.payment_collections?.[0]?.payments?.[0]
    if (!payment) {
      res.status(400).json({ error: "No payment found on this order." })
      return
    }
    if (payment.status !== "captured") {
      res.status(400).json({ error: `Payment is not in a refundable state (status: ${payment.status}).` })
      return
    }

    const paystackRef = (payment.data?.["reference"] as string) || (payment.data?.["ghana_charge_ref"] as string)
    if (!paystackRef) {
      res.status(400).json({ error: "No Paystack transaction reference found on this payment. Manual refund required." })
      return
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      res.status(500).json({ error: "PAYSTACK_SECRET_KEY not configured." })
      return
    }

    // Calculate amount in pesewas
    const currency = ret.order?.currency_code || "ghs"
    let amountPesewas: number
    if (body?.amount_ghs !== undefined && body.amount_ghs > 0) {
      amountPesewas = toPaystackAmountPesewas(body.amount_ghs, currency)
    } else {
      // Full refund: ret.refund_amount is already in major units (GHS)
      amountPesewas = toPaystackAmountPesewas(ret.refund_amount ?? payment.amount / 100, currency)
    }

    const result = await refundCharge({ secretKey, reference: paystackRef, amountPesewas })

    if (!result.ok) {
      res.status(502).json({ error: `Paystack refund failed: ${result.error}` })
      return
    }

    writeAuditLog({
      action: "payment.refunded",
      actorId: "admin",
      actorType: "user",
      resourceId: returnId,
      resourceType: "order",
      details: {
        paystack_refund_id: result.id,
        reference: paystackRef,
        amount_pesewas: amountPesewas,
        order_id: ret.order_id,
      },
    })

    res.json({
      return_id: returnId,
      refund_id: result.id,
      amount_pesewas: amountPesewas,
      reference: paystackRef,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to process refund" })
  }
}
