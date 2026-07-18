/**
 * POST /vendor/alkemart/products/:id/propose
 * Convenience: re-score quality, stamp metadata, set status proposed.
 * Soft gates still apply (seller readiness + quality). Not the sole enforcement path —
 * create with status=proposed also hits workflow validate hooks.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  assertCanSell,
  evaluateSellerReadiness,
} from "../../../../../../lib/seller-readiness"
import {
  assertCanPropose,
  qualityMetadataSnapshot,
} from "../../../../../../lib/product-quality"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export async function POST(req: SellerReq, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "product id required" })
    return
  }

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

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      res.status(404).json({ error: "Seller not found" })
      return
    }
    try {
      assertCanSell(readiness, "propose")
    } catch (e) {
      res.status(403).json({
        error: e instanceof Error ? e.message : "Cannot propose products",
        readiness: {
          phase: readiness.phase,
          checklist: readiness.checklist,
          next_action: readiness.next_action,
        },
      })
      return
    }

    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "description",
        "thumbnail",
        "status",
        "metadata",
        "images.url",
        "categories.id",
        "seller.id",
      ],
      filters: { id: productId },
    })
    const product = asList(data)[0]
    if (!product) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    const seller = product.seller as { id?: string } | null
    if (seller?.id && seller.id !== sellerId) {
      res.status(403).json({ error: "Product belongs to another seller" })
      return
    }

    const status = String(product.status || "").toLowerCase()
    if (status === "published") {
      res.status(400).json({ error: "Product is already published" })
      return
    }
    if (status === "rejected") {
      res.status(400).json({
        error:
          "Product was rejected. Create a new listing or wait for ops guidance.",
      })
      return
    }

    let quality
    try {
      quality = assertCanPropose({
        title: product.title as string,
        description: product.description as string,
        thumbnail: product.thumbnail as string,
        images: product.images as Array<{ url?: string }>,
        categories: product.categories as Array<{ id?: string }>,
      })
    } catch (e) {
      res.status(400).json({
        error: e instanceof Error ? e.message : "Quality gate failed",
      })
      return
    }

    const meta = (product.metadata as Record<string, unknown>) || {}
    const alk =
      meta.alkemart && typeof meta.alkemart === "object"
        ? { ...(meta.alkemart as Record<string, unknown>) }
        : {}
    alk.quality = qualityMetadataSnapshot(quality)

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (
        id: string,
        data: { status?: string; metadata?: Record<string, unknown> },
      ) => Promise<unknown>
    }

    await productModule.updateProducts(productId, {
      status: "proposed",
      metadata: { ...meta, alkemart: alk },
    })

    res.status(200).json({
      product_id: productId,
      status: "proposed",
      quality: {
        score: quality.score,
        band: quality.band,
      },
      message: "Submitted for alkemart review",
    })
  } catch (e) {
    if (e instanceof MedusaError) {
      res.status(400).json({ error: e.message })
      return
    }
    res.status(500).json({
      error: e instanceof Error ? e.message : "Propose failed",
    })
  }
}
