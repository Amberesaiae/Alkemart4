/**
 * GET /vendor/alkemart/products/:id/quality
 * Quality score + media derivative status for Seller Hub UI.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { scoreProductQuality } from "../../../../../../lib/product-quality"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export async function GET(req: SellerReq, res: MedusaResponse) {
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

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
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

    if (sellerId) {
      const seller = product.seller as { id?: string } | null
      if (seller?.id && seller.id !== sellerId) {
        res.status(403).json({ error: "Product belongs to another seller" })
        return
      }
    }

    const quality = scoreProductQuality({
      title: product.title as string,
      description: product.description as string,
      thumbnail: product.thumbnail as string,
      images: product.images as Array<{ url?: string }>,
      categories: product.categories as Array<{ id?: string }>,
      status: product.status as string,
    })

    const meta = (product.metadata as Record<string, unknown>) || {}
    const alk = (meta.alkemart as Record<string, unknown>) || {}
    const media = alk.media || null
    const storedQuality = alk.quality || null

    res.status(200).json({
      product_id: product.id,
      status: product.status,
      quality,
      stored_quality: storedQuality,
      media,
      propose_ok: quality.blocking.length === 0,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to score product",
    })
  }
}
