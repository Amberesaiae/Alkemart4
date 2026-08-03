/**
 * POST /vendor/alkemart/orders/:id/cancel
 *
 * Vendor requests a cancellation. This does NOT hard-cancel the order —
 * it sets metadata.cancel_requested_by_vendor = true so an admin can confirm.
 *
 * Hard cancellation is an admin-only action to avoid data races with
 * in-flight fulfillments.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../../lib/graph-utils.ts"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

function getSellerId(req: SellerReq): string {
  return (
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    (typeof req.get === "function" ? req.get("x-seller-id") : "") ||
    ""
  )
}

export async function POST(req: SellerReq, res: MedusaResponse) {
  const sellerId = getSellerId(req)
  if (!sellerId) {
    res.status(400).json({ error: "Seller context required." })
    return
  }

  const orderId = req.params.id
  const body = req.body as { reason?: string } | undefined

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    // Verify ownership
    const { data: links } = await query.graph({
      entity: "order_seller",
      fields: ["order_id"],
      filters: { seller_id: sellerId, order_id: orderId },
    })
    if (!asList(links).length) {
      res.status(403).json({ error: "Order not found or does not belong to your shop." })
      return
    }

    // Fetch current metadata
    const { data: orderData } = await query.graph({
      entity: "order",
      fields: ["id", "status", "metadata"],
      filters: { id: orderId },
    })
    const order = asList(orderData)[0] as { id: string; status: string; metadata?: Record<string, unknown> } | undefined

    if (!order) {
      res.status(404).json({ error: "Order not found." })
      return
    }
    if (order.status === "canceled") {
      res.status(409).json({ error: "Order is already canceled." })
      return
    }

    const orderService = req.scope.resolve(Modules.ORDER) as {
      updateOrders: (updates: Array<{ id: string; metadata: Record<string, unknown> }>) => Promise<unknown>
    }

    await orderService.updateOrders([{
      id: orderId,
      metadata: {
        ...(order.metadata || {}),
        cancel_requested_by_vendor: true,
        cancel_requested_at: new Date().toISOString(),
        cancel_request_reason: body?.reason || null,
        cancel_requested_seller_id: sellerId,
      },
    }])

    res.json({
      order_id: orderId,
      status: "cancel_requested",
      message: "Cancellation request submitted. An admin will review and confirm.",
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to request cancellation" })
  }
}
