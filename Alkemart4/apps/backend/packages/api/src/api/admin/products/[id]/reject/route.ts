import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils.ts"
import { logger } from "../../../../../lib/logger.ts"
import { writeAuditLog } from "../../../../../lib/audit-log.ts"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const { reason } = (req.body || {}) as { reason?: string }
  if (!reason?.trim()) {
    res.status(400).json({ error: "Rejection reason is required." })
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
      res.status(400).json({ error: `Cannot reject a product with status "${status}".` })
      return
    }

    const meta = (product.metadata as Record<string, unknown>) || {}
    const alk = (meta.alkemart && typeof meta.alkemart === "object"
      ? { ...(meta.alkemart as Record<string, unknown>) }
      : {}) as Record<string, unknown>
    alk.moderation = {
      action: "rejected",
      reason: reason.trim(),
      at: new Date().toISOString(),
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (id: string, data: Record<string, unknown>) => Promise<unknown>
    }

    await productModule.updateProducts(productId, {
      status: "rejected",
      metadata: { ...meta, alkemart: alk },
    })

    writeAuditLog({
      action: "product.rejected",
      actorId: "admin",
      actorType: "user",
      resourceId: productId,
      resourceType: "product",
      details: { title: product.title, reason: reason.trim() },
    })

    res.status(200).json({
      product_id: productId,
      status: "rejected",
      message: "Product rejected.",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to reject product",
    })
  }
}
