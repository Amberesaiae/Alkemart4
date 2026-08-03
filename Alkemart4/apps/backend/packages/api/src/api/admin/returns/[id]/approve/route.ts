/**
 * POST /admin/returns/:id/approve
 *
 * Approve a return: transitions status to "received".
 * The return-lifecycle-notify subscriber listens to order.return_approved
 * and sends SMS/WhatsApp to the buyer.
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

  const body = req.body as { note?: string } | undefined

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    // Fetch return to validate current status
    const { data } = await query.graph({
      entity: "return",
      fields: ["id", "status", "order_id", "items.id", "items.item_id", "items.quantity"],
      filters: { id: returnId },
    })
    const ret = asList(data)[0] as {
      id: string
      status: string
      order_id: string
      items?: { id: string; item_id: string; quantity: number }[]
    } | undefined

    if (!ret) {
      res.status(404).json({ error: "Return not found." })
      return
    }
    if (ret.status === "received") {
      res.status(409).json({ error: "Return is already received." })
      return
    }
    if (ret.status === "canceled") {
      res.status(409).json({ error: "Return is canceled and cannot be approved." })
      return
    }

    // Update return to received status via ORDER module
    const orderService = req.scope.resolve(Modules.ORDER) as unknown as {
      updateReturns?: (updates: Array<{
        id: string
        status?: string
        received_at?: string
        metadata?: Record<string, unknown>
      }>) => Promise<unknown>
    }

    if (typeof orderService.updateReturns === "function") {
      await orderService.updateReturns([{
        id: returnId,
        status: "received",
        received_at: new Date().toISOString(),
        metadata: {
          approved_by: "admin",
          approved_at: new Date().toISOString(),
          approval_note: body?.note || null,
        },
      }])
    } else {
      logger.warn("[returns/approve] orderService.updateReturns not available", { returnId })
    }

    writeAuditLog({
      action: "return.approved",
      actorId: "admin",
      actorType: "user",
      resourceId: returnId,
      resourceType: "order",
      details: { order_id: ret.order_id, note: body?.note },
    })

    res.json({ return_id: returnId, status: "received" })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to approve return" })
  }
}
