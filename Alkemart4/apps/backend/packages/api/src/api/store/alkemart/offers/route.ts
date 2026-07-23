/**
 * GET /store/alkemart/offers
 *
 * Buyer peer-offer list for multi-seller PDP comparison.
 * Query:
 *   product_id (required) — only offers for this published product
 *   limit (optional, default 20, max 50)
 *
 * Never invents sellers/prices — open sellers + published products only.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { checkRateLimit } from "../../../../lib/simple-rate-limit"

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = str(req.query?.product_id || req.query?.productId)
  if (!productId) {
    res.status(400).json({ error: "product_id is required" })
    return
  }

  const rl = checkRateLimit({
    key: `alkemart-offers:${productId}`,
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec))
    res.status(429).json({ error: "Too many offer polls. Try again shortly." })
    return
  }

  const limitRaw = req.query?.limit
  const limit = Math.min(
    Math.max(
      typeof limitRaw === "string"
        ? Number(limitRaw)
        : typeof limitRaw === "number"
          ? limitRaw
          : 20,
      1,
    ),
    50,
  )

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "offer",
      fields: [
        "id",
        "product_id",
        "variant_id",
        "seller_id",
        "sku",
        "seller.id",
        "seller.name",
        "seller.handle",
        "seller.status",
        "prices.id",
        "prices.amount",
        "prices.currency_code",
        "product.id",
        "product.status",
        "product.title",
        "product.handle",
        "product.thumbnail",
      ],
      filters: { product_id: productId },
    })

    type Peer = {
      id: string
      offer_id: string
      product_id: string
      variant_id: string | null
      sku: string | null
      amount: number | null
      currency_code: string | null
      seller: {
        id: string | null
        name: string
        handle: string | null
      }
      product: {
        id: string
        title: string | null
        handle: string | null
        thumbnail: string | null
      } | null
    }

    const offers: Peer[] = []
    for (const o of asList(data)) {
      const offerId = str(o.id)
      if (!offerId) continue
      const product = (o.product as Record<string, unknown> | null) || null
      const pStatus = str(product?.status).toLowerCase()
      if (pStatus && pStatus !== "published") continue

      const seller = (o.seller as Record<string, unknown> | null) || null
      const sellerStatus = str(seller?.status || "open").toLowerCase()
      if (sellerStatus && sellerStatus !== "open") continue
      const sellerName = str(seller?.name)
      if (!sellerName) continue

      // Prefer GHS amount
      let amount: number | null = null
      let currency: string | null = null
      for (const p of asList(o.prices)) {
        const a = num(p.amount)
        if (a == null) continue
        const code = str(p.currency_code).toLowerCase() || null
        if (code === "ghs") {
          amount = a
          currency = "ghs"
          break
        }
        if (amount == null) {
          amount = a
          currency = code
        }
      }

      offers.push({
        id: offerId,
        offer_id: offerId,
        product_id: productId,
        variant_id: str(o.variant_id) || null,
        sku: str(o.sku) || null,
        amount,
        currency_code: currency,
        seller: {
          id: str(seller?.id) || null,
          name: sellerName,
          handle: str(seller?.handle) || null,
        },
        product: product?.id
          ? {
              id: str(product.id),
              title: str(product.title) || null,
              handle: str(product.handle) || null,
              thumbnail: str(product.thumbnail) || null,
            }
          : null,
      })
    }

    // Sort by amount ascending (nulls last)
    offers.sort((a, b) => {
      if (a.amount == null && b.amount == null) return 0
      if (a.amount == null) return 1
      if (b.amount == null) return -1
      return a.amount - b.amount
    })

    const page = offers.slice(0, limit)

    res.status(200).json({
      offers: page,
      count: offers.length,
      limit,
      product_id: productId,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Offers list failed",
    })
  }
}
