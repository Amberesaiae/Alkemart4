/**
 * POST /vendor/alkemart/products/:id/propose
 * Simplified: checks seller is approved + open, scores quality (advisory),
 * stamps metadata, sets status proposed. No quality gate.
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
  scoreProductQuality,
  qualityMetadataSnapshot,
} from "../../../../../../lib/product-quality"
import { asList } from "../../../../../../lib/graph-utils"
import { checkRateLimit } from "../../../../../../lib/rate-limiter"
import { logger } from "../../../../../../lib/logger"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
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
    ""

  if (!sellerId) {
    res.status(400).json({
      error: "Seller context required — select a store in Seller Hub first.",
    })
    return
  }

  const rateKey = `${sellerId}:${productId}`
  const allowed = await checkRateLimit(rateKey, 10, 60_000)
  if (!allowed) {
    res.status(429).json({
      error: "Too many requests. Please wait a moment and try again.",
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

    if (!seller?.id) {
      // Verify explicit product_seller link (prevent proposing shared-catalog
      // products that have no explicit ownership)
      const { data: linkData } = await query.graph({
        entity: "product_seller",
        fields: ["product_id", "seller_id"],
        filters: { product_id: productId, seller_id: sellerId },
      })
      const linkRows = Array.isArray(linkData) ? linkData : linkData ? [linkData] : []
      if (!linkRows.length) {
        res.status(403).json({ error: "Product not linked to your shop" })
        return
      }
    }

    const status = String(product.status || "").toLowerCase()
    if (status === "published") {
      res.status(400).json({ error: "Product is already published" })
      return
    }

    // Quality is advisory — never blocks
    const quality = scoreProductQuality({
      title: product.title as string,
      description: product.description as string,
      thumbnail: product.thumbnail as string,
      images: product.images as Array<{ url?: string }>,
      categories: product.categories as Array<{ id?: string }>,
    })

    const meta = (product.metadata as Record<string, unknown>) || {}
    const alk =
      meta.alkemart && typeof meta.alkemart === "object"
        ? { ...(meta.alkemart as Record<string, unknown>) }
        : {}
    alk.quality = qualityMetadataSnapshot(quality)
    delete alk.moderation

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

    const { data: verifyRows } = await query.graph({
      entity: "product",
      fields: ["id", "status"],
      filters: { id: productId },
    })
    const verified = asList(verifyRows)[0]
    const newStatus = String(verified?.status || "").toLowerCase()
    if (newStatus !== "proposed") {
      logger.error(`[alkemart] propose concurrency conflict: product ${productId} expected "proposed" but found "${newStatus}"`)
      res.status(409).json({
        error: "Product status changed during submission. Please refresh and try again.",
      })
      return
    }

    res.status(200).json({
      product_id: productId,
      status: "proposed",
      quality: {
        score: quality.score,
        band: quality.band,
      },
      message: "Submitted for review",
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
