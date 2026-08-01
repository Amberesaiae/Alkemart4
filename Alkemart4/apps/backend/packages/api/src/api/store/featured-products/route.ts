import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "description",
      "metadata",
      "sale_status",
      "sellers.id",
      "sellers.name",
      "sellers.handle",
      "images.url",
    ],
    filters: {
      status: "published",
    },
  })

  const featured = (data as Record<string, unknown>[]).filter((p) => {
    const meta = p.metadata as Record<string, unknown> | null
    return meta?.featured === "true"
  }).map((p) => {
    const sellers = (p.sellers as Array<Record<string, unknown>> | undefined) ?? []
    const seller = sellers[0] ?? null
    return { ...p, seller }
  })

  res.json({ products: featured })
}
