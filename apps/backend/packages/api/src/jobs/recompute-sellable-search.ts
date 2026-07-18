/**
 * Safety-net reindex of sellable products every 15 minutes.
 * Primary path is event subscribers; this catches missed events.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isSearchEnabled } from "../lib/search/client"
import { reindexAllProducts } from "../lib/search/service"
import { logger } from "../lib/logger"

export default async function recomputeSellableSearchJob(
  container: MedusaContainer,
) {
  if (!isSearchEnabled()) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const result = await reindexAllProducts(query)
    logger.info("search.reindex_job", result)
  } catch (e) {
    logger.error("search.reindex_job_failed", {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config = {
  name: "alkemart-recompute-sellable-search",
  schedule: "*/15 * * * *",
}
