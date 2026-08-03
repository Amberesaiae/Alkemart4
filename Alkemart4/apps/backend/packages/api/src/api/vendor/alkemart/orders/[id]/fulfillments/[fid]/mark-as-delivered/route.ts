/**
 * POST /vendor/alkemart/orders/:id/fulfillments/:fid/mark-as-delivered
 *
 * Mark a shipped fulfillment as delivered.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../../../../lib/graph-utils.ts"
import { writeAuditLog } from "../../../../../../../../lib/audit-log.ts"

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
  const fulfillmentId = req.params.fid

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    // Verify order ownership
    const { data: links } = await query.graph({
      entity: "order_seller",
      fields: ["order_id"],
      filters: { seller_id: sellerId, order_id: orderId },
    })
    if (!asList(links).length) {
      res.status(403).json({ error: "Order not found or does not belong to your shop." })
      return
    }

    const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT) as unknown as {
      updateFulfillment: (id: string, data: Record<string, unknown>) => Promise<{ id: string; status: string }>
    }

    const updated = await fulfillmentService.updateFulfillment(fulfillmentId, {
      delivered_at: new Date().toISOString(),
      metadata: { marked_delivered_by_seller: sellerId },
    })

    writeAuditLog({
      action: "order.fulfilled",
      actorId: sellerId,
      actorType: "seller",
      resourceId: orderId,
      resourceType: "order",
      details: { fulfillment_id: fulfillmentId, action: "delivered" },
    })

    res.json({ fulfillment: updated })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to mark fulfillment as delivered" })
  }
}
