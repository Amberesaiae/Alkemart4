/**
 * POST /vendor/alkemart/orders/:id/fulfillments
 *
 * Create a fulfillment for the seller's own items on this order.
 * Body: { items: [{ id: string; quantity: number }] }
 *
 * Uses Medusa's fulfillment module service directly.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../../lib/graph-utils"
import { writeAuditLog } from "../../../../../../lib/audit-log"

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
  const body = req.body as { items?: { id: string; quantity: number }[] }
  const items = body?.items

  if (!items?.length) {
    res.status(400).json({ error: "items[] is required — provide at least one line item to fulfill." })
    return
  }

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

    // Fetch order to get location_id and shipping option
    const { data: orderData } = await query.graph({
      entity: "order",
      fields: ["id", "location_id", "shipping_methods.shipping_option_id"],
      filters: { id: orderId },
    })
    const order = asList(orderData)[0] as {
      id: string
      location_id?: string
      shipping_methods?: { shipping_option_id?: string }[]
    }

    const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT) as unknown as {
      createFulfillment: (data: Record<string, unknown>) => Promise<{ id: string; status: string }>
    }

    const fulfillment = await fulfillmentService.createFulfillment({
      order_id: orderId,
      location_id: order?.location_id || null,
      items: items.map((i) => ({ order_line_item_id: i.id, quantity: i.quantity })),
      delivery_address: null,
      labels: [],
      metadata: { created_by_seller: sellerId },
    })

    writeAuditLog({
      action: "order.fulfilled",
      actorId: sellerId,
      actorType: "seller",
      resourceId: orderId,
      resourceType: "order",
      details: { fulfillment_id: fulfillment.id, items },
    })

    res.status(201).json({ fulfillment })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to create fulfillment" })
  }
}
