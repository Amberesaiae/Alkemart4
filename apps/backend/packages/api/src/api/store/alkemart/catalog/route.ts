/**
 * GET /store/alkemart/catalog
 * Buyer-facing product cards filtered toward sellable (published + has offer).
 * Sourced from Mercur offers (SoT for ATC), not variant.offer_id graph fields.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { paginate } from "../../../../lib/catalog-map"

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  const limitRaw = req.query?.limit
  const offsetRaw = req.query?.offset
  const limit = Math.min(
    Math.max(
      typeof limitRaw === "string"
        ? Number(limitRaw)
        : typeof limitRaw === "number"
          ? limitRaw
          : 24,
      1,
    ),
    100,
  )
  const offset = Math.max(
    typeof offsetRaw === "string"
      ? Number(offsetRaw)
      : typeof offsetRaw === "number"
        ? offsetRaw
        : 0,
    0,
  )

  try {
    // Offers are the marketplace sellable unit (cart uses offer_id)
    const { data: offerData } = await query.graph({
      entity: "offer",
      fields: [
        "id",
        "product_id",
        "variant_id",
        "seller_id",
        "seller.id",
        "seller.name",
        "seller.handle",
        "seller.status",
        "product.id",
        "product.title",
        "product.handle",
        "product.thumbnail",
        "product.description",
        "product.status",
      ],
    })

    const byProduct = new Map<
      string,
      {
        id: string
        title: unknown
        handle: unknown
        thumbnail: unknown
        description: unknown
        offer_id: string
        seller: {
          id: string | null
          name: string | null
          handle: string | null
        } | null
      }
    >()

    for (const o of asList(offerData)) {
      const offerId = typeof o.id === "string" ? o.id : ""
      const product = (o.product as Record<string, unknown> | null) || null
      const productId =
        (typeof product?.id === "string" && product.id) ||
        (typeof o.product_id === "string" ? o.product_id : "")
      if (!offerId || !productId) continue

      const status = String(product?.status || "").toLowerCase()
      if (status && status !== "published") continue

      const sellerRaw = o.seller as Record<string, unknown> | null
      const sellerStatus = String(sellerRaw?.status || "open").toLowerCase()
      if (sellerStatus && sellerStatus !== "open") continue

      if (byProduct.has(productId)) continue

      byProduct.set(productId, {
        id: productId,
        title: product?.title,
        handle: product?.handle,
        thumbnail: product?.thumbnail,
        description: product?.description,
        offer_id: offerId,
        seller: sellerRaw
          ? {
              id: (sellerRaw.id as string) ?? null,
              name: (sellerRaw.name as string) ?? null,
              handle: (sellerRaw.handle as string) ?? null,
            }
          : null,
      })
    }

    const all = Array.from(byProduct.values())
    const products = paginate(all, offset, limit)

    res.status(200).json({
      products,
      count: all.length,
      limit,
      offset,
      filter: "published_with_offer",
      note: "Built from Mercur offers + published products; open sellers only",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Catalog list failed",
    })
  }
}
