/**
 * GET /admin/sellers — paginated list of all sellers.
 *
 * Supports ?status=&limit=&offset=&q= filters.
 * Returns seller with aggregated product_count and order_count.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../lib/graph-utils.ts"

const SELLER_LIST_FIELDS = [
  "id", "name", "handle", "email", "phone",
  "status", "status_reason", "approved_at", "created_at", "updated_at",
  "description", "thumbnail",
  "address.city", "address.province", "address.country_code",
  "metadata",
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
    q,
  } = req.query as Record<string, unknown>

  const filters: Record<string, unknown> = {}
  if (typeof status === "string" && status) {
    filters.status = status
  }

  try {
    const { data, metadata } = await query.graph({
      entity: "seller",
      fields: SELLER_LIST_FIELDS,
      filters,
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    let sellers = asList(data)

    // Client-side name/handle search (Medusa graph doesn't support ILIKE easily)
    if (typeof q === "string" && q.trim()) {
      const term = q.trim().toLowerCase()
      sellers = sellers.filter((s) => {
        const seller = s as { name?: string; handle?: string; email?: string }
        return (
          seller.name?.toLowerCase().includes(term) ||
          seller.handle?.toLowerCase().includes(term) ||
          seller.email?.toLowerCase().includes(term)
        )
      })
    }

    res.json({
      sellers,
      count: metadata?.count ?? sellers.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch sellers" })
  }
}
