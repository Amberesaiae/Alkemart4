/**
 * Re-evaluate product sellable index when offers change.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isSearchEnabled } from "../lib/search/client"
import {
  fetchProductsForIndex,
  upsertProductDocuments,
} from "../lib/search/service"

export default async function searchOfferSync({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string; product_id?: string }>) {
  if (!isSearchEnabled()) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  let productId = data?.product_id
  if (!productId && data?.id) {
    try {
      const { data: offerData } = await query.graph({
        entity: "offer",
        fields: ["id", "product_id"],
        filters: { id: data.id },
      })
      const row = Array.isArray(offerData) ? offerData[0] : offerData
      productId =
        row && typeof row === "object"
          ? String((row as { product_id?: string }).product_id || "")
          : undefined
    } catch {
      return
    }
  }

  if (!productId) return

  try {
    const docs = await fetchProductsForIndex(query, [productId])
    await upsertProductDocuments(docs)
  } catch (e) {
    console.error(
      "[search] offer sync failed",
      productId,
      e instanceof Error ? e.message : e,
    )
  }
}

export const config: SubscriberConfig = {
  event: ["offer.created", "offer.updated", "offer.deleted"],
}
