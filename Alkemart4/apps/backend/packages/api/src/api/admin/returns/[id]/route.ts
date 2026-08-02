/**
 * GET /admin/returns/:id — full return detail with items, order context, and refund eligibility.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../lib/graph-utils"

const RETURN_DETAIL_FIELDS = [
  "id", "display_id", "status", "refund_amount", "metadata",
  "created_at", "updated_at", "requested_at", "received_at", "canceled_at",
  "order_id",
  "order.id", "order.display_id", "order.status", "order.currency_code",
  "order.total", "order.subtotal",
  "order.customer.id", "order.customer.email",
  "order.customer.first_name", "order.customer.last_name", "order.customer.phone",
  "order.shipping_address.first_name", "order.shipping_address.last_name",
  "order.shipping_address.address_1", "order.shipping_address.city",
  "order.shipping_address.province",
  "items.id", "items.item_id", "items.quantity", "items.received_quantity",
  "items.damaged_quantity", "items.reason_id", "items.note",
  "items.item.title", "items.item.thumbnail", "items.item.unit_price",
  "order.payment_collections.id",
  "order.payment_collections.status",
  "order.payment_collections.payments.id",
  "order.payment_collections.payments.status",
  "order.payment_collections.payments.amount",
  "order.payment_collections.payments.provider_id",
  "order.payment_collections.payments.data",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const returnId = req.params.id
  if (!returnId) {
    res.status(400).json({ error: "Return id required." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "return",
      fields: RETURN_DETAIL_FIELDS,
      filters: { id: returnId },
    })
    const ret = asList(data)[0] as Record<string, unknown> | undefined
    if (!ret) {
      res.status(404).json({ error: "Return not found." })
      return
    }

    // Compute refund eligibility
    const order = ret.order as
      | { payment_collections?: { payments?: { id: string; status: string; amount: number; data?: Record<string, unknown> }[] }[] }
      | null
    const payment = order?.payment_collections?.[0]?.payments?.[0]
    const canRefund =
      payment?.status === "captured" &&
      !!(payment?.data?.["reference"] || payment?.id)

    res.json({
      return: {
        ...ret,
        payment_id: payment?.id ?? null,
        payment_status: payment?.status ?? null,
        payment_amount: payment?.amount ?? null,
        payment_reference: (payment?.data?.["reference"] as string) ?? null,
        can_refund: canRefund,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch return" })
  }
}
