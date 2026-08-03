/**
 * GET  /admin/orders/:id — full order detail with all seller lines, fulfillments, payment, returns.
 * POST /admin/orders/:id/cancel — hard cancel an order (admin-only).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../lib/graph-utils.ts"

const DETAIL_FIELDS = [
  "id", "display_id", "status", "fulfillment_status", "payment_status",
  "total", "subtotal", "shipping_total", "tax_total", "discount_total",
  "currency_code", "metadata", "created_at", "updated_at",
  "customer.id", "customer.email", "customer.first_name", "customer.last_name", "customer.phone",
  "billing_address.first_name", "billing_address.last_name",
  "billing_address.address_1", "billing_address.address_2",
  "billing_address.city", "billing_address.province", "billing_address.country_code",
  "shipping_address.first_name", "shipping_address.last_name",
  "shipping_address.address_1", "shipping_address.address_2",
  "shipping_address.city", "shipping_address.province", "shipping_address.country_code",
  "shipping_address.phone",
  "items.id", "items.title", "items.thumbnail", "items.quantity",
  "items.unit_price", "items.subtotal", "items.variant_id",
  "items.variant.title", "items.variant.sku",
  "shipping_methods.name", "shipping_methods.total",
  "fulfillments.id", "fulfillments.status", "fulfillments.shipped_at",
  "fulfillments.delivered_at", "fulfillments.canceled_at", "fulfillments.data",
  "fulfillments.items.id", "fulfillments.items.quantity",
  "payment_collections.id", "payment_collections.status", "payment_collections.amount",
  "payment_collections.payments.id", "payment_collections.payments.status",
  "payment_collections.payments.amount", "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "returns.id", "returns.status", "returns.refund_amount",
  "returns.requested_at", "returns.received_at", "returns.items.id", "returns.items.quantity",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  if (!orderId) {
    res.status(400).json({ error: "Order id required." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "order",
      fields: DETAIL_FIELDS,
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
