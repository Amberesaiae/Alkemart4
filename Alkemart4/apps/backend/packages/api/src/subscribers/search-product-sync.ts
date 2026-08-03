import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isSearchEnabled } from "../lib/search/client.ts"
import {
  fetchProductsForIndex,
  upsertProductDocuments,
} from "../lib/search/service.ts"
import { logger } from "../lib/logger.ts"

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
    logger.error("[search] product sync failed", {
      id,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
