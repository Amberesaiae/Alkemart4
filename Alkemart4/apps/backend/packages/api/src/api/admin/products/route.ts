import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../lib/graph-utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number } }>
  }

  const { limit = 50, offset = 0, q } = req.query as Record<string, unknown>

  const filters: Record<string, unknown> = {}
  if (typeof q === "string" && q.trim()) {
    filters.q = q.trim()
  }

  const fields = [
    "id", "title", "thumbnail", "metadata", "sale_status", "created_at",
    "seller.name", "seller.handle",
  ]

  try {
    const { data, metadata } = await query.graph({
      entity: "product",
      fields,
      filters,
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    const products = (asList(data) as Record<string, unknown>[]).map((p) => ({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail ?? null,
      metadata: (p.metadata as Record<string, unknown> | null) ?? null,
      sale_status: p.sale_status,
      created_at: p.created_at,
      seller: p.seller ?? null,
    }))

    res.json({
      products,
      count: metadata?.count ?? products.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (e) {
    res.status(500).json({
      type: "unknown_error",
      code: "unknown_error",
      message: e instanceof Error ? e.message : "Failed to fetch products",
    })
  }
}
