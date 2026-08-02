import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const fields = [
    "id", "title", "subtitle", "description", "handle",
    "thumbnail", "collection_id", "type_id",
    "created_at", "updated_at",
    "*type", "*collection", "*options", "*options.values", "*tags", "*images",
    "*variants", "*variants.options",
  ]

  const filters: Record<string, unknown> = {
    status: "published",
  }

  const pkHeader = req.headers["x-publishable-api-key"] as string | undefined

  try {
    const { data, metadata } = await query.graph({
      entity: "product",
      fields,
      filters,
      pagination: { skip: 0, take: 50 },
    })

    res.json({
      header_present: !!pkHeader,
      header_value: pkHeader ? pkHeader.slice(0, 10) + "..." : null,
      filters_used: filters,
      count: metadata?.count ?? (Array.isArray(data) ? data.length : 0),
      products: (Array.isArray(data) ? data : []).map((p: Record<string, unknown>) => ({
        id: p.id, title: p.title, status: p.status,
      })),
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
