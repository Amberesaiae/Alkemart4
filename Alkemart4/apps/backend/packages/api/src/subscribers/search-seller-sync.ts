/**
 * When a seller is suspended/terminated/approved, reindex their products
 * so non-sellable shops leave discovery.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isSearchEnabled } from "../lib/search/client"
import {
  deleteProductDocuments,
  fetchProductsForIndex,
  upsertProductDocuments,
} from "../lib/search/service"

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

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
    let products = asList(data)
    // Fallback filter shapes
    if (!products.length) {
      const all = await query.graph({
        entity: "product",
        fields: ["id", "seller.id"],
      })
      products = asList(all.data).filter((p) => {
        const s = p.seller as { id?: string } | undefined
        return s?.id === sellerId
      })
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
    console.error(
      "[search] seller sync failed",
      sellerId,
      e instanceof Error ? e.message : e,
    )
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
