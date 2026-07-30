import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils"
import { logger } from "../../../../../lib/logger"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const { reason } = (req.body || {}) as { reason?: string }
  if (!reason?.trim()) {
    res.status(400).json({ error: "Feedback message is required." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "status", "metadata"],
      filters: { id: productId },
    })
    const product = asList(data)[0]
    if (!product) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    const status = String(product.status || "").toLowerCase()
    if (status !== "proposed") {
      res.status(400).json({ error: `Cannot request changes for a product with status "${status}".` })
      return
    }

    const meta = (product.metadata as Record<string, unknown>) || {}
    const alk = (meta.alkemart && typeof meta.alkemart === "object"
      ? { ...(meta.alkemart as Record<string, unknown>) }
      : {}) as Record<string, unknown>
    alk.moderation = {
      action: "changes_requested",
      reason: reason.trim(),
      at: new Date().toISOString(),
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (id: string, data: Record<string, unknown>) => Promise<unknown>
    }

    await productModule.updateProducts(productId, {
      metadata: { ...meta, alkemart: alk },
    })

    res.status(200).json({
      product_id: productId,
      status: "proposed",
      message: "Changes requested. Seller will be notified.",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to request changes",
    })
  }
}
