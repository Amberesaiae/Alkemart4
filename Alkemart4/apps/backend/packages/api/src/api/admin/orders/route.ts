import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../lib/graph-utils.ts"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number } }>
  }

  const { limit = 50, offset = 0, status } = req.query as Record<string, unknown>
  const filters: Record<string, unknown> = { is_draft_order: false }
  if (status) filters.status = status

  const fields = [
    "id", "display_id", "status", "fulfillment_status", "payment_status",
    "total", "currency_code", "created_at",
    "customer.id", "customer.email", "customer.first_name", "customer.last_name",
  ]

  try {
    const { data, metadata } = await query.graph({
      entity: "order",
      fields,
      filters,
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    const orders = (asList(data) as Record<string, unknown>[]).map((o) => ({
      id: o.id,
      display_id: o.display_id,
      status: o.status,
      fulfillment_status: o.fulfillment_status,
      payment_status: o.payment_status,
      total: o.total,
      currency_code: o.currency_code,
      created_at: o.created_at,
      customer: o.customer || null,
    }))

    res.json({
      orders,
      count: metadata?.count ?? orders.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (e) {
    res.status(500).json({
      type: "unknown_error",
      code: "unknown_error",
      message: e instanceof Error ? e.message : "Failed to fetch orders",
    })
  }
}
