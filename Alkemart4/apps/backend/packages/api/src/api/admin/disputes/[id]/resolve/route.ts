/**
 * POST /admin/disputes/:id/resolve
 *
 * Resolve a dispute. Decision is recorded in metadata.
 * If decision is "favor_buyer" and a Paystack reference exists,
 * a refund is issued automatically.
 *
 * Body: {
 *   decision: "favor_buyer" | "favor_seller" | "partial"
 *   refund_amount_ghs?: number   // for "partial" decision
 *   note?: string
 * }
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils.ts"
import { refundCharge, toPaystackAmountPesewas } from "../../../../../lib/paystack-client.ts"
import { writeAuditLog } from "../../../../../lib/audit-log.ts"
import { logger } from "../../../../../lib/logger.ts"

type Decision = "favor_buyer" | "favor_seller" | "partial"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const returnId = req.params.id
  if (!returnId) {
    res.status(400).json({ error: "Dispute (return) id required." })
    return
  }

  const body = req.body as {
    decision?: Decision
    refund_amount_ghs?: number
    note?: string
  } | undefined

  const VALID: Decision[] = ["favor_buyer", "favor_seller", "partial"]
  if (!body?.decision || !VALID.includes(body.decision)) {
    res.status(400).json({ error: `decision must be one of: ${VALID.join(", ")}` })
    return
  }
  if (body.decision === "partial" && !(body.refund_amount_ghs && body.refund_amount_ghs > 0)) {
    res.status(400).json({ error: "refund_amount_ghs is required for a partial decision." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "return",
      fields: [
        "id", "status", "refund_amount", "metadata", "order_id",
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
      metadata?: Record<string, unknown>
      order_id: string
      order?: {
        currency_code?: string
        payment_collections?: { payments?: { id: string; status: string; amount: number; data?: Record<string, unknown> }[] }[]
      }
    } | undefined

    if (!ret) {
      res.status(404).json({ error: "Dispute not found." })
      return
    }

    const meta = ret.metadata || {}
    if (!meta.is_disputed) {
      res.status(409).json({ error: "This return is not escalated as a dispute." })
      return
    }
    if (meta.dispute_status === "resolved") {
      res.status(409).json({ error: "This dispute is already resolved." })
      return
    }

    let refundResult: { ok: boolean; id?: number; error?: string } | null = null

    // Issue refund for buyer-favorable decisions
    if (body.decision === "favor_buyer" || body.decision === "partial") {
      const payment = ret.order?.payment_collections?.[0]?.payments?.[0]
      const paystackRef = (payment?.data?.["reference"] as string) ||
        (payment?.data?.["ghana_charge_ref"] as string)
      const secretKey = process.env.PAYSTACK_SECRET_KEY

      if (paystackRef && secretKey && payment?.status === "captured") {
        const currency = ret.order?.currency_code || "ghs"
        const amountGhs = body.decision === "partial"
          ? body.refund_amount_ghs!
          : (ret.refund_amount ?? payment.amount / 100)
        const amountPesewas = toPaystackAmountPesewas(amountGhs, currency)

        refundResult = await refundCharge({ secretKey, reference: paystackRef, amountPesewas })
        if (!refundResult.ok) {
          logger.warn("[disputes/resolve] Paystack refund failed — dispute resolved without refund", {
            returnId,
            error: refundResult.error,
          })
        }
      }
    }

    // Record resolution in metadata
    const orderService = req.scope.resolve(Modules.ORDER) as unknown as {
      updateReturns?: (updates: Array<{ id: string; metadata: Record<string, unknown> }>) => Promise<unknown>
    }

    if (typeof orderService.updateReturns === "function") {
      await orderService.updateReturns([{
        id: returnId,
        metadata: {
          ...meta,
          dispute_status: "resolved",
          dispute_decision: body.decision,
          dispute_resolved_at: new Date().toISOString(),
          dispute_resolution_note: body.note || null,
          dispute_refund_id: refundResult?.id ?? null,
        },
      }])
    }

    writeAuditLog({
      action: "payment.refunded",
      actorId: "admin",
      actorType: "user",
      resourceId: returnId,
      resourceType: "order",
      details: {
        action: "dispute_resolved",
        decision: body.decision,
        order_id: ret.order_id,
        refund_issued: refundResult?.ok ?? false,
      },
    })

    res.json({
      dispute: { return_id: returnId, status: "resolved", decision: body.decision },
      refund: refundResult?.ok ? { id: refundResult.id } : null,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to resolve dispute" })
  }
}
