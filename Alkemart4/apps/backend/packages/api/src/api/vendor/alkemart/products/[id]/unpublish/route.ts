/**
 * POST /vendor/alkemart/products/:id/unpublish
 *
 * Vendor self-service: takes a LIVE (published) product down to `proposed`
 * so the seller can edit it safely, then re-propose (POST .../propose) and
 * wait for admin re-approval before it returns to published.
 *
 * First principles:
 *  - ownership is enforced via the product_seller link (same check as siblings)
 *  - only `published` may be unpublished (idempotent guard)
 *  - stamps metadata.alkemart.unpublished for audit + invalidates the
 *    seller-owned product-id cache so the list reflects the new state
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  isUnpublishableStatus,
  normalizeStatus,
} from "../../../../../../lib/product-lifecycle.ts"
import { asList } from "../../../../../../lib/graph-utils.ts"
import { logger } from "../../../../../../lib/logger.ts"
import { checkRateLimit } from "../../../../../../lib/simple-rate-limit.ts"
import {
  invalidateSellerOwnedProductIds,
} from "../../../../../../lib/seller-owned-products-cache.ts"
import { writeAuditLog } from "../../../../../../lib/audit-log.ts"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

function sellerId(req: SellerReq): string {
  return (
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    (typeof req.get === "function" ? req.get("x-seller-id") : "") ||
    ""
  )
}

async function verifyOwnership(
  query: { graph: (args: unknown) => Promise<{ data: unknown }> },
  productId: string,
  sid: string,
): Promise<boolean> {
  const { data } = await query.graph({
    entity: "product_seller",
    fields: ["product_id"],
    filters: { product_id: productId, seller_id: sid },
  })
  return Array.isArray(data) && data.length > 0
}

export async function POST(req: SellerReq, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const sid = sellerId(req)
  if (!sid) {
    res.status(400).json({ error: "Seller context required — select a store first." })
    return
  }

  const rl = checkRateLimit({
    key: `product-unpublish:${sid}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return res.status(429).json({
      error: "Too many actions. Please wait before retrying.",
      retry_after_sec: rl.retryAfterSec,
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const owned = await verifyOwnership(query, productId, sid)
    if (!owned) {
      res.status(403).json({ error: "Product not found or not yours." })
      return
    }

    const { data: productRows } = await query.graph({
      entity: "product",
      fields: ["id", "status", "metadata"],
      filters: { id: productId },
    })
    const product = asList(productRows)[0] as {
      id: string
      status?: string | null
      metadata?: Record<string, unknown> | null
    } | undefined

    if (!product) {
      res.status(404).json({ error: "Product not found." })
      return
    }

    const current = normalizeStatus(product.status)
    if (!isUnpublishableStatus(current)) {
      res.status(400).json({
        error: `Only live (published) products can be unpublished. Current status: "${current}".`,
        next_action: {
          edit: "PUT /vendor/alkemart/products/:id is allowed for draft/proposed/rejected.",
        },
      })
      return
    }

    const meta = (product.metadata as Record<string, unknown>) || {}
    const alk =
      meta.alkemart && typeof meta.alkemart === "object"
        ? { ...(meta.alkemart as Record<string, unknown>) }
        : {}
    alk.unpublished = { by: sid, at: new Date().toISOString(), reason: "seller_edit" }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (id: string, data: Record<string, unknown>) => Promise<unknown>
    }

    await productModule.updateProducts(productId, {
      status: "proposed",
      metadata: { ...meta, alkemart: { ...alk } },
    })

    writeAuditLog({
      action: "product.unpublished",
      actorId: sid,
      actorType: "seller",
      resourceId: productId,
      resourceType: "product",
      details: { title: undefined, from: "published", to: "proposed" },
    })

    void invalidateSellerOwnedProductIds(sid).catch((e) => {
      logger.error("[alkemart] unpublish: cache invalidate failed", {
        error: e instanceof Error ? e.message : e,
      })
    })

    res.status(200).json({
      product_id: productId,
      status: "proposed",
      message:
        "Product taken down for editing. Update it, then re-propose — admin re-approval republishes it.",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to unpublish product",
    })
  }
}
