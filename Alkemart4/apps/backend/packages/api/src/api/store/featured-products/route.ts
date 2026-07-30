import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "description",
      "metadata",
      "sale_status",
      "seller.name",
      "seller.handle",
      "images.url",
    ],
    filters: {
      status: "published",
    },
  })

  const featured = (products as Record<string, unknown>[]).filter((p) => {
    const meta = p.metadata as Record<string, unknown> | null
    return meta?.featured === "true"
  })

  res.json({ products: featured })
}
