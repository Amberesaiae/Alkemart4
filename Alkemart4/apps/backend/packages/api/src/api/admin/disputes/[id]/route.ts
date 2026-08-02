/**
 * GET /admin/disputes/:id — full dispute detail (return with is_disputed=true).
 *
 * :id is the return id.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../lib/graph-utils"

const DISPUTE_DETAIL_FIELDS = [
  "id", "display_id", "status", "refund_amount", "metadata",
  "created_at", "updated_at", "requested_at", "received_at",
  "order_id",
  "order.id", "order.display_id", "order.status", "order.currency_code", "order.total",
  "order.customer.id", "order.customer.email",
  "order.customer.first_name", "order.customer.last_name", "order.customer.phone",
  "order.shipping_address.address_1", "order.shipping_address.city",
  "items.id", "items.item_id", "items.quantity", "items.note",
  "items.item.title", "items.item.thumbnail", "items.item.unit_price",
  "order.payment_collections.payments.id",
  "order.payment_collections.payments.status",
  "order.payment_collections.payments.amount",
  "order.payment_collections.payments.data",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const returnId = req.params.id
  if (!returnId) {
    res.status(400).json({ error: "Dispute (return) id required." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "return",
      fields: DISPUTE_DETAIL_FIELDS,
      filters: { id: returnId },
    })
    const ret = asList(data)[0] as Record<string, unknown> | undefined
    if (!ret) {
      res.status(404).json({ error: "Dispute not found." })
      return
    }

    const meta = (ret.metadata as Record<string, unknown>) || {}
    if (!meta.is_disputed) {
      res.status(404).json({ error: "This return is not escalated as a dispute." })
      return
    }

    res.json({ dispute: ret })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch dispute" })
  }
}
