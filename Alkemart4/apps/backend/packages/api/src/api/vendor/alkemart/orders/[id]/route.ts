/**
 * GET /vendor/alkemart/orders/:id — full order detail for a seller-owned order.
 *
 * Returns 403 if the order does not belong to the requesting seller.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils.ts"

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

const ORDER_DETAIL_FIELDS = [
  "id", "display_id", "status", "fulfillment_status", "payment_status",
  "total", "subtotal", "shipping_total", "tax_total", "currency_code",
  "metadata", "created_at", "updated_at",
  "customer.id", "customer.email", "customer.first_name", "customer.last_name", "customer.phone",
  "shipping_address.first_name", "shipping_address.last_name",
  "shipping_address.address_1", "shipping_address.address_2",
  "shipping_address.city", "shipping_address.province", "shipping_address.country_code",
  "shipping_address.phone",
  "items.id", "items.title", "items.thumbnail", "items.quantity",
  "items.unit_price", "items.subtotal", "items.variant_id",
  "items.variant.title", "items.variant.sku",
  "fulfillments.id", "fulfillments.status", "fulfillments.shipped_at",
  "fulfillments.delivered_at", "fulfillments.canceled_at",
  "fulfillments.data", "fulfillments.items.id", "fulfillments.items.quantity",
  "payment_collections.id", "payment_collections.status",
  "payment_collections.payments.id", "payment_collections.payments.status",
  "payment_collections.payments.amount", "payment_collections.payments.provider_id",
  "returns.id", "returns.status", "returns.refund_amount", "returns.requested_at",
]

export async function GET(req: SellerReq, res: MedusaResponse) {
  const sellerId = getSellerId(req)
  if (!sellerId) {
    res.status(400).json({ error: "Seller context required." })
    return
  }

  const orderId = req.params.id
  if (!orderId) {
    res.status(400).json({ error: "Order id required." })
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

    const { data } = await query.graph({
      entity: "order",
      fields: ORDER_DETAIL_FIELDS,
      filters: { id: orderId },
    })
    const order = asList(data)[0]
    if (!order) {
      res.status(404).json({ error: "Order not found." })
      return
    }

    res.json({ order })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch order" })
  }
}
