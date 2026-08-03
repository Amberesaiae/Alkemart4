/**
 * GET /vendor/alkemart/orders — paginated list of orders for the authenticated seller.
 *
 * Uses the order_seller Mercur link to scope results to the requesting vendor.
 * Supports ?fulfillment_status=&payment_status=&limit=&offset= filters.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../lib/graph-utils.ts"

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

const ORDER_LIST_FIELDS = [
  "id", "display_id", "status", "fulfillment_status", "payment_status",
  "total", "currency_code", "created_at", "updated_at",
  "customer.id", "customer.email", "customer.first_name", "customer.last_name", "customer.phone",
  "shipping_address.first_name", "shipping_address.last_name",
  "shipping_address.address_1", "shipping_address.city", "shipping_address.province",
  "items.id", "items.title", "items.thumbnail", "items.quantity", "items.unit_price", "items.variant_id",
]

export async function GET(req: SellerReq, res: MedusaResponse) {
  const sellerId = getSellerId(req)
  if (!sellerId) {
    res.status(400).json({ error: "Seller context required." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number; skip?: number; take?: number } }>
  }

  const {
    limit = 50,
    offset = 0,
    fulfillment_status,
    payment_status,
  } = req.query as Record<string, unknown>

  try {
    // Step 1: get all order_ids linked to this seller
    const { data: links } = await query.graph({
      entity: "order_seller",
      fields: ["order_id"],
      filters: { seller_id: sellerId },
    })
    const orderIds = asList(links).map((l) => (l as { order_id: string }).order_id)

    if (!orderIds.length) {
      return res.json({ orders: [], count: 0, offset: Number(offset), limit: Number(limit) })
    }

    // Step 2: fetch orders scoped to those ids
    const filters: Record<string, unknown> = { id: orderIds, is_draft_order: false }
    if (typeof fulfillment_status === "string" && fulfillment_status) {
      filters.fulfillment_status = fulfillment_status
    }
    if (typeof payment_status === "string" && payment_status) {
      filters.payment_status = payment_status
    }

    const { data, metadata } = await query.graph({
      entity: "order",
      fields: ORDER_LIST_FIELDS,
      filters,
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    res.json({
      orders: asList(data),
      count: metadata?.count ?? 0,
      offset: metadata?.skip ?? 0,
      limit: metadata?.take ?? Number(limit),
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch orders" })
  }
}
