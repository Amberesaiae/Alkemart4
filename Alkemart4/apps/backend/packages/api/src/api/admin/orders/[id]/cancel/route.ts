/**
 * POST /admin/orders/:id/cancel — hard cancel an order (admin-only).
 *
 * Uses the Medusa ORDER module service to cancel the order.
 * Only valid for orders in pending/processing states.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils"
import { writeAuditLog } from "../../../../../lib/audit-log"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  if (!orderId) {
    res.status(400).json({ error: "Order id required." })
    return
  }

  const body = req.body as { reason?: string } | undefined

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    // Fetch current status to guard state
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "status", "metadata"],
      filters: { id: orderId },
    })
    const order = asList(data)[0] as { id: string; status: string; metadata?: Record<string, unknown> } | undefined

    if (!order) {
      res.status(404).json({ error: "Order not found." })
      return
    }
    if (order.status === "canceled") {
      res.status(409).json({ error: "Order is already canceled." })
      return
    }
    if (order.status === "completed") {
      res.status(409).json({ error: "Cannot cancel a completed order." })
      return
    }

    const orderService = req.scope.resolve(Modules.ORDER) as {
      cancelOrder?: (orderId: string) => Promise<unknown>
      updateOrders?: (updates: Array<{ id: string; status: string; metadata?: Record<string, unknown> }>) => Promise<unknown>
    }

    // Try the cancelOrder method first (Medusa v2 IOrderModuleService)
    if (typeof orderService.cancelOrder === "function") {
      await orderService.cancelOrder(orderId)
    } else if (typeof orderService.updateOrders === "function") {
      // Fallback: update status directly
      await orderService.updateOrders([{
        id: orderId,
        status: "canceled",
        metadata: {
          ...(order.metadata || {}),
          canceled_by: "admin",
          canceled_at: new Date().toISOString(),
          cancellation_reason: body?.reason || null,
        },
      }])
    } else {
      res.status(501).json({ error: "Order cancellation is not supported by the current module configuration." })
      return
    }

    writeAuditLog({
      action: "order.canceled",
      actorId: "admin",
      actorType: "user",
      resourceId: orderId,
      resourceType: "order",
      details: { reason: body?.reason || null },
    })

    res.json({ order_id: orderId, status: "canceled" })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to cancel order" })
  }
}
