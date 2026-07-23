/**
 * POST /vendor/alkemart/quick-list
 * One-step product listing for Ghana sellers: title + price + photo → proposed.
 * Creates product + offer in a single call.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOffersWorkflow } from "@mercurjs/core/workflows"
import { evaluateSellerReadiness } from "../../../../lib/seller-readiness"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string; member_id?: string }
  session?: { seller_id?: string }
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export async function POST(req: SellerReq, res: MedusaResponse) {
  const sellerId =
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    ""

  if (!sellerId) {
    res.status(400).json({
      error: "Select your shop first, then try again.",
    })
    return
  }

  const body = (req.body || {}) as Record<string, unknown>
  const title = String(body.title || "").trim()
  const price_ghs = Number(body.price_ghs) || 0
  const description = String(body.description || "").trim()
  const category_id = String(body.category_id || "").trim() || undefined
  const image_url = String(body.image_url || "").trim() || undefined

  if (!title || title.length < 3) {
    res.status(400).json({ error: "Title must be at least 3 characters." })
    return
  }
  if (price_ghs < 0.5) {
    res.status(400).json({ error: "Price must be at least GH₵0.50." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      res.status(404).json({ error: "Seller not found." })
      return
    }

    if (readiness.mercur_status !== "open") {
      const msg =
        readiness.mercur_status === "pending_approval"
          ? "Your shop is under review. You can list once approved."
          : readiness.mercur_status === "suspended"
            ? "Your shop is paused. Contact support to reopen."
            : "Cannot list products."
      res.status(403).json({ error: msg, readiness })
      return
    }

    if (readiness.phase === "setup_incomplete") {
      res.status(400).json({
        error:
          "Set your pack address and delivery fee first (use the form on your dashboard).",
        readiness,
      })
      return
    }

    const { data: sellerData } = await query.graph({
      entity: "seller",
      fields: [
        "id",
        "stock_locations.id",
        "stock_locations.name",
        "shipping_profiles.id",
        "shipping_profiles.name",
      ],
      filters: { id: sellerId },
    })
    const seller = asList(sellerData)[0] as Record<string, unknown> | undefined
    const stockLocations = (seller?.stock_locations || []) as Array<{ id: string }>
    const shippingProfiles = (seller?.shipping_profiles || []) as Array<{ id: string }>
    const stockLocationId = stockLocations[0]?.id
    const shippingProfileId = shippingProfiles[0]?.id

    if (!stockLocationId || !shippingProfileId) {
      res.status(400).json({
        error:
          "Set your pack address and delivery fee first (use the form on your dashboard).",
      })
      return
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>

    const product = await productModule.create({
      title,
      description: description || undefined,
      thumbnail: image_url || undefined,
      categories: category_id ? [{ id: category_id }] : undefined,
      status: "proposed",
      metadata: {
        alkemart: {
          origin: "quick-list",
          price_ghs,
        },
      },
    }) as Record<string, unknown> | undefined

    if (!product?.id) {
      res.status(500).json({ error: "Product creation failed." })
      return
    }

    const { data: productData } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { id: product.id },
    })
    const prodRow = asList(productData)[0] as Record<string, unknown> | undefined
    const variants = (prodRow?.variants || []) as Array<{ id: string }>
    const variantId = variants[0]?.id

    if (!variantId) {
      res.status(500).json({ error: "Product created but no variant found." })
      return
    }

    const offerSku = `QL-${String(product.id).slice(0, 8)}`
    await createOffersWorkflow(req.scope).run({
      input: {
        offers: [
          {
            seller_id: sellerId,
            created_by: req.seller_context?.member_id || sellerId,
            variant_id: variantId,
            shipping_profile_id: shippingProfileId,
            sku: offerSku,
            inventory_items: [
              {
                sku: offerSku,
                stock_levels: [
                  {
                    location_id: stockLocationId,
                    stocked_quantity: 999,
                  },
                ],
              },
            ],
            prices: [{ amount: price_ghs, currency_code: "ghs" }],
          },
        ],
      },
    })

    res.status(201).json({
      product_id: product.id,
      status: "proposed",
      message: "Listed for review. We'll check it shortly.",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Quick list failed"
    console.error(`[alkemart] quick-list error for seller ${sellerId}:`, msg)
    res.status(500).json({ error: msg })
  }
}
