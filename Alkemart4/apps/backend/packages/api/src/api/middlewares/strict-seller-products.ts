/**
 * Alkemart exclusive-seller product list (pragmatic).
 *
 * Mercur's default vendor product filter includes published products with
 * NO product_seller row (shared master catalog). That leaks lab/demo
 * products into every new shop.
 *
 * Hot path: ONE graph query on product_seller only.
 * We intentionally do NOT probe product_change / product_change_action —
 * those secondary graphs often hang or time out on Neon and turned a
 * correct list into 15–20s empty waits for sellers who already have links.
 *
 * Ownership for creates is guaranteed by product-created-link-seller.
 */
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getCachedOwnedProductIds,
  setCachedOwnedProductIds,
} from "../../lib/seller-owned-products-cache.ts"
import { logger } from "../../lib/logger.ts"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  filterableFields?: Record<string, unknown>
}

/** Sentinel id — Medusa `id: []` is unsafe; never matches real products. */
export const EXCLUSIVE_PRODUCT_NONE_ID =
  "prod_alkemart_none_0000000000000000"

/**
 * Pure filter merge used by middleware + unit tests.
 * Drops Mercur shared-catalog `$and`/`$or` and scopes by owned ids only.
 */
export function buildExclusiveProductFilter(
  ownedIds: string[],
  prev: Record<string, unknown> = {},
): Record<string, unknown> {
  const { $and: _a, $or: _o, id: _id, ...rest } = prev
  return {
    ...rest,
    id: ownedIds.length > 0 ? ownedIds : [EXCLUSIVE_PRODUCT_NONE_ID],
  }
}

/**
 * Resolve owned product ids — product_seller only (fast path).
 * Exported for tests / scripts.
 */
export async function resolveOwnedProductIds(
  scope: MedusaRequest["scope"],
  sellerId: string,
): Promise<string[]> {
  const cached = await getCachedOwnedProductIds(sellerId)
  if (cached) return cached

  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  const ids = new Set<string>()

  try {
    const { data: links } = await query.graph({
      entity: "product_seller",
      fields: ["product_id"],
      filters: { seller_id: sellerId },
    })
    const list = Array.isArray(links) ? links : links ? [links] : []
    for (const row of list) {
      const id = (row as { product_id?: string })?.product_id
      if (id) ids.add(id)
    }
  } catch (e) {
    logger.error("[strict-seller-products] product_seller ownership query failed", { error: e instanceof Error ? e.message : e })
    // Fail closed at caller; empty set → sentinel
  }

  // Optional slow path — off by default. Only for debugging historical
  // orphans without product_seller (should not be needed after create hook).
  if (
    process.env.STRICT_SELLER_INCLUDE_AUTHORSHIP === "1" ||
    process.env.STRICT_SELLER_INCLUDE_AUTHORSHIP === "true"
  ) {
    try {
      const { data: changes } = await query.graph({
        entity: "product_change",
        fields: ["actions.product_id"],
        filters: { created_by: sellerId },
      })
      const list = Array.isArray(changes) ? changes : changes ? [changes] : []
      for (const ch of list) {
        const actions =
          (ch as { actions?: { product_id?: string }[] })?.actions || []
        for (const a of actions) {
          if (a?.product_id) ids.add(a.product_id)
        }
      }
    } catch {
      /* optional */
    }
  }

  const out = Array.from(ids)
  void setCachedOwnedProductIds(sellerId, out).catch(() => {})
  return out
}

/**
 * Strict exclusive filter for GET /vendor/products.
 * Must run after Mercur applySellerProductLinkFilter (same matcher).
 */
export async function applyStrictSellerProductFilter(
  req: SellerReq,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  try {
    const sellerId =
      req.seller_context?.seller_id ||
      (typeof req.get === "function" ? req.get("x-seller-id") : "") ||
      ""

    if (!sellerId) {
      logger.warn("[seller] no seller_id in auth context or header; falling back to first seller")
      return next()
    }

    const owned = await resolveOwnedProductIds(req.scope, sellerId)
    const prev = (req.filterableFields || {}) as Record<string, unknown>
    req.filterableFields = buildExclusiveProductFilter(owned, prev)
  } catch (e) {
    // Fail closed: empty list rather than leak other sellers' products
    req.filterableFields = buildExclusiveProductFilter(
      [],
      (req.filterableFields || {}) as Record<string, unknown>,
    )
    logger.error("[strict-seller-products] filter failed", { error: e instanceof Error ? e.message : e })
  }

  return next()
}
