/**
 * When a seller is suspended/terminated/approved, reindex their products
 * so non-sellable shops leave discovery.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isSearchEnabled } from "../lib/search/client.ts"
import {
  deleteProductDocuments,
  fetchProductsForIndex,
  upsertProductDocuments,
} from "../lib/search/service.ts"
import { logger } from "../lib/logger.ts"
import { asList } from "../lib/graph-utils.ts"
export default async function searchSellerSync({
  event,
  container,
}: SubscriberArgs<{ id?: string; seller_id?: string }>) {
  if (!isSearchEnabled()) return
  const sellerId = event.data?.id || event.data?.seller_id
  if (!sellerId) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "seller.id"],
      filters: { seller: { id: sellerId } },
    })
    const products = asList(data)
    if (!products.length) {
      logger.warn("[search] seller sync: no products found for seller", { sellerId })
      return
    }

    const ids = products.map((p) => String(p.id)).filter(Boolean)
    if (!ids.length) return

    // Suspended/terminated → drop from index
    if (
      event.name === "seller.suspended" ||
      event.name === "seller.terminated"
    ) {
      await deleteProductDocuments(ids)
      return
    }

    const docs = await fetchProductsForIndex(query, ids)
    await upsertProductDocuments(docs)
  } catch (e) {
    logger.error("[search] seller sync failed", {
      sellerId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "seller.approved",
    "seller.suspended",
    "seller.unsuspended",
    "seller.terminated",
    "seller.unterminated",
  ],
}
