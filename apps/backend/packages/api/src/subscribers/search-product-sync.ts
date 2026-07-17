import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isSearchEnabled } from "../lib/search/client"
import {
  fetchProductsForIndex,
  upsertProductDocuments,
} from "../lib/search/service"

/**
 * Keep discovery index in sync when products change.
 * No-op when MEILISEARCH_HOST is unset.
 */
export default async function searchProductSync({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!isSearchEnabled()) return
  const id = data?.id
  if (!id) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const docs = await fetchProductsForIndex(query, [id])
    await upsertProductDocuments(docs)
  } catch (e) {
    console.error(
      "[search] product sync failed",
      id,
      e instanceof Error ? e.message : e,
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
