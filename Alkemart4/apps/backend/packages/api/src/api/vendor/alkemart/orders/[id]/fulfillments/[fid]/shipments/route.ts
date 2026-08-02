/**
 * POST /vendor/alkemart/orders/:id/fulfillments/:fid/shipments
 *
 * Mark a fulfillment as shipped. Optionally attach tracking number + URL.
 * Body: { tracking_number?: string; tracking_url?: string }
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../../../../lib/graph-utils"
import { writeAuditLog } from "../../../../../../../../lib/audit-log"

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
  const body = req.body as { tracking_number?: string; tracking_url?: string } | undefined

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
      updateFulfillment: (id: string, data: Record<string, unknown>) => Promise<{ id: string; status: string; shipped_at?: string }>
    }

    const labels: Array<{ tracking_number: string; tracking_url: string | null }> = []
    if (body?.tracking_number) {
      labels.push({
        tracking_number: body.tracking_number,
        tracking_url: body.tracking_url || null,
      })
    }

    const updated = await fulfillmentService.updateFulfillment(fulfillmentId, {
      shipped_at: new Date().toISOString(),
      labels: labels.length ? labels : undefined,
      metadata: {
        marked_shipped_by_seller: sellerId,
        tracking_number: body?.tracking_number || null,
        tracking_url: body?.tracking_url || null,
      },
    })

    writeAuditLog({
      action: "order.shipped",
      actorId: sellerId,
      actorType: "seller",
      resourceId: orderId,
      resourceType: "order",
      details: { fulfillment_id: fulfillmentId, tracking: body?.tracking_number },
    })

    res.json({ fulfillment: updated })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to mark fulfillment as shipped" })
  }
}
