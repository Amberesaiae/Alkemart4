/**
 * GET /admin/returns — paginated list of all return requests across all sellers.
 *
 * Supports ?status=&order_id=&limit=&offset= filters.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../lib/graph-utils.ts"

const RETURN_LIST_FIELDS = [
  "id", "display_id", "status", "refund_amount", "metadata",
  "created_at", "updated_at", "requested_at", "received_at", "canceled_at",
  "order_id",
  "order.display_id", "order.status", "order.currency_code", "order.total",
  "order.customer.id", "order.customer.email",
  "order.customer.first_name", "order.customer.last_name",
  "items.id", "items.item_id", "items.quantity", "items.received_quantity",
  "items.damaged_quantity", "items.reason_id", "items.note",
  "order.payment_collections.payments.id",
  "order.payment_collections.payments.status",
  "order.payment_collections.payments.amount",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{
      data: unknown
      metadata?: { count?: number; skip?: number; take?: number }
    }>
  }

  const {
    limit = 50,
    offset = 0,
    status,
    order_id,
  } = req.query as Record<string, unknown>

  const filters: Record<string, unknown> = {}
  if (typeof status === "string" && status) filters.status = status
  if (typeof order_id === "string" && order_id) filters.order_id = order_id

  try {
    const { data, metadata } = await query.graph({
      entity: "return",
      fields: RETURN_LIST_FIELDS,
      filters,
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    // Enrich with payment info (for refund eligibility)
    const returns = asList(data).map((r) => {
      const order = (r as Record<string, unknown>).order as
        | { payment_collections?: { payments?: { id: string; status: string; amount: number }[] }[] }
        | null
      const payment = order?.payment_collections?.[0]?.payments?.[0]
      const { order: _o, ...rest } = r as Record<string, unknown>
      return {
        ...rest,
        order: _o,
        payment_id: payment?.id ?? null,
        payment_status: payment?.status ?? null,
        payment_amount: payment?.amount ?? null,
      }
    })

    res.json({
      returns,
      count: metadata?.count ?? returns.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch returns" })
  }
}
