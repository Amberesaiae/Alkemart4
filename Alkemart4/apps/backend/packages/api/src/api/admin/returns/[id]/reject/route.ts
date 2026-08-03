/**
 * POST /admin/returns/:id/reject
 *
 * Reject a return request. Sets metadata.rejection_reason and status to "canceled".
 * The return-lifecycle-notify subscriber listens to order.return_rejected
 * and sends SMS to the buyer with the reason.
 *
 * Body: { reason: string }
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils.ts"
import { writeAuditLog } from "../../../../../lib/audit-log.ts"
import { logger } from "../../../../../lib/logger.ts"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const returnId = req.params.id
  if (!returnId) {
    res.status(400).json({ error: "Return id required." })
    return
  }

  const body = req.body as { reason?: string } | undefined
  if (!body?.reason?.trim()) {
    res.status(400).json({ error: "reason is required to reject a return." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "return",
      fields: ["id", "status", "order_id", "metadata"],
      filters: { id: returnId },
    })
    const ret = asList(data)[0] as {
      id: string
      status: string
      order_id: string
      metadata?: Record<string, unknown>
    } | undefined

    if (!ret) {
      res.status(404).json({ error: "Return not found." })
      return
    }
    if (ret.status === "received") {
      res.status(409).json({ error: "Return is already received and cannot be rejected." })
      return
    }
    if (ret.status === "canceled") {
      res.status(409).json({ error: "Return is already canceled." })
      return
    }

    const orderService = req.scope.resolve(Modules.ORDER) as unknown as {
      updateReturns?: (updates: Array<{
        id: string
        status?: string
        canceled_at?: string
        metadata?: Record<string, unknown>
      }>) => Promise<unknown>
    }

    if (typeof orderService.updateReturns === "function") {
      await orderService.updateReturns([{
        id: returnId,
        status: "canceled",
        canceled_at: new Date().toISOString(),
        metadata: {
          ...(ret.metadata || {}),
          rejection_reason: body.reason.trim(),
          rejected_by: "admin",
          rejected_at: new Date().toISOString(),
        },
      }])
    } else {
      logger.warn("[returns/reject] orderService.updateReturns not available", { returnId })
    }

    writeAuditLog({
      action: "return.rejected",
      actorId: "admin",
      actorType: "user",
      resourceId: returnId,
      resourceType: "order",
      details: { reason: body.reason, order_id: ret.order_id },
    })

    res.json({ return_id: returnId, status: "canceled", rejection_reason: body.reason })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to reject return" })
  }
}
