import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../lib/graph-utils.ts"
import { logger } from "../../../lib/logger.ts"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "thumbnail",
        "metadata",
        "sale_status",
        "created_at",
        "sellers.id",
        "sellers.name",
        "sellers.handle",
      ],
    })

    const productsRaw = asList(data) as Record<string, unknown>[]
    const featured = productsRaw
      .filter((p) => {
        const meta = p.metadata as Record<string, unknown> | null
        return meta?.featured === "true"
      })
      .map((p) => {
        const sellers = (p.sellers as Array<Record<string, unknown>> | undefined) ?? []
        return { ...p, seller: sellers[0] ?? null }
      })

    res.json({ products: featured })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to list featured products",
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>
  const id = String(body.id || "").trim()
  const featured = String(body.featured || "").trim()

  if (!id) {
    res.status(400).json({ error: "Product id is required." })
    return
  }
  if (featured !== "true" && featured !== "false") {
    res.status(400).json({ error: "featured must be 'true' or 'false'." })
    return
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }

    const { data: existing } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      filters: { id },
    })
    const product = asList(existing)[0]
    if (!product) {
      res.status(404).json({ error: "Product not found." })
      return
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (id: string, data: { metadata?: Record<string, unknown> }) => Promise<unknown>
    }

    const existingMeta = (product as Record<string, unknown>).metadata as Record<string, unknown> | undefined
    await productModule.updateProducts(id, {
      metadata: { ...existingMeta, featured },
    })

    res.json({ success: true })
  } catch (e) {
    logger.error("[admin] featured-products toggle failed", { productId: id, error: e instanceof Error ? e.message : e })
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to toggle featured status",
    })
  }
}
