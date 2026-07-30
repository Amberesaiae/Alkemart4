import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { createOffersWorkflow } from "@mercurjs/core/workflows"
import { asList } from "../../../../../lib/graph-utils"
import { logger } from "../../../../../lib/logger"
import { writeAuditLog } from "../../../../../lib/audit-log"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "status",
        "metadata",
        "variants.id",
        "variants.prices.amount",
        "variants.prices.currency_code",
        "seller.id",
        "seller.name",
        "seller.stock_locations.id",
        "seller.shipping_profiles.id",
      ],
      filters: { id: productId },
    })
    const product = asList(data)[0]
    if (!product) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    const status = String(product.status || "").toLowerCase()
    if (status !== "proposed") {
      res.status(400).json({ error: `Cannot approve a product with status "${status}". Only proposed products can be approved.` })
      return
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (id: string, data: Record<string, unknown>) => Promise<unknown>
    }

    await productModule.updateProducts(productId, { status: "published" })

    const seller = product.seller as Record<string, unknown> | undefined
    const sellerId = seller?.id as string | undefined
    const variants = (product.variants || []) as Array<{ id: string; prices?: Array<{ amount: number; currency_code: string }> }>
    const variantId = variants[0]?.id

    if (sellerId && variantId) {
      const { data: offerData } = await query.graph({
        entity: "offer",
        fields: ["id"],
        filters: { variant_id: variantId },
      })
      const existingOffers = asList(offerData)

      if (existingOffers.length === 0) {
        try {
          const stockLocations = (seller?.stock_locations || []) as Array<{ id: string }>
          const shippingProfiles = (seller?.shipping_profiles || []) as Array<{ id: string }>
          const stockLocationId = stockLocations[0]?.id
          const shippingProfileId = shippingProfiles[0]?.id
          const defaultPrice = variants[0]?.prices?.[0]?.amount || 0
          const defaultCurrency = variants[0]?.prices?.[0]?.currency_code || "ghs"

          const offerSku = `AP-${productId.slice(0, 8)}`
          await createOffersWorkflow(req.scope).run({
            input: {
              offers: [{
                seller_id: sellerId as string,
                created_by: sellerId as string,
                variant_id: variantId as string,
                shipping_profile_id: shippingProfileId || "",
                sku: offerSku,
                inventory_items: [{
                  sku: offerSku,
                  stock_levels: [{
                    location_id: stockLocationId || "",
                    stocked_quantity: 1,
                  }],
                }],
                prices: [{ amount: defaultPrice, currency_code: defaultCurrency }],
              }],
            },
          })
          logger.info("[alkemart] approve: offer auto-created", { productId, variantId })
        } catch (offerErr) {
          logger.error("[alkemart] approve: offer creation failed", { productId, error: offerErr instanceof Error ? offerErr.message : offerErr })
        }
      }
    }

    writeAuditLog({
      action: "product.approved",
      actorId: "admin",
      actorType: "user",
      resourceId: productId,
      resourceType: "product",
      details: { title: product.title },
    })

    res.status(200).json({
      product_id: productId,
      status: "published",
      message: "Product approved and published.",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to approve product",
    })
  }
}
