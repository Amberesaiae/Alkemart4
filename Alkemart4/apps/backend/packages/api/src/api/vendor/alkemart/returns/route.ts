/**
 * GET /vendor/alkemart/returns — seller-scoped returns list enriched with the
 * order's first payment id so the UI can issue refunds via
 * POST /vendor/payments/:id/refund.
 * Mirrors Mercur's /vendor/returns shape but adds payment_id / payment_status.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

const RETURN_FIELDS = [
  "id", "order_id", "display_id", "status", "refund_amount",
  "created_at", "updated_at", "requested_at", "received_at", "canceled_at",
  "items.id", "items.item_id", "items.quantity", "items.received_quantity",
  "items.damaged_quantity", "items.reason_id", "items.note",
  "order.payment_collections.payments.id",
  "order.payment_collections.payments.status",
]

export async function GET(req: SellerReq, res: MedusaResponse) {
  const sellerId =
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    req.get("x-seller-id") ||
    ""

  if (!sellerId) {
    res.status(400).json({
      error: "Seller context required — select a store in Seller Hub first.",
    })
    return
  }

  const { limit = 50, offset = 0, status, order_id } = req.query as Record<string, unknown>
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: Record<string, unknown>[]; metadata?: { count?: number; skip?: number; take?: number } }>
  }

  try {
    const filters: Record<string, unknown> = {}

    if (typeof order_id === "string" && order_id) {
      filters.order_id = order_id
    } else {
      const { data: orderLinks } = await query.graph({
        entity: "order_seller",
        fields: ["order_id"],
        filters: { seller_id: sellerId },
      })
      filters.order_id = (orderLinks as Array<{ order_id: string }>).map((l) => l.order_id)
    }

    if (typeof status === "string" && status) {
      filters.status = status
    }

    const { data: returns, metadata } = await query.graph({
      entity: "return",
      fields: RETURN_FIELDS,
      filters,
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    const enriched = (returns as Record<string, unknown>[]).map((r) => {
      const collections = (r.order as Record<string, unknown> | null)
        ?.payment_collections as Array<{ payments: Array<{ id: string; status: string }> }> | undefined
      const payment = collections?.[0]?.payments?.[0]
      const { order, ...rest } = r
      return {
        ...rest,
        payment_id: payment?.id ?? null,
        payment_status: payment?.status ?? null,
      }
    })

    res.json({
      returns: enriched,
      count: metadata?.count ?? 0,
      offset: metadata?.skip ?? 0,
      limit: metadata?.take ?? 0,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to fetch returns",
    })
  }
}
