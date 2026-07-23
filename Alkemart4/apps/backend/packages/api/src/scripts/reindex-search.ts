/**
 * CLI: full search reindex
 *   medusa exec ./src/scripts/reindex-search.ts
 *
 * Requires MEILISEARCH_HOST (+ API key) and DATABASE_URL.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reindexAllProducts, searchHealth } from "../lib/search/service"

export default async function reindexSearch({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const health = await searchHealth()
  logger.info(`Search health: ${JSON.stringify(health)}`)

  if (!health.enabled) {
    logger.warn("MEILISEARCH_HOST not set — nothing to reindex")
    return
  }
  if (!health.reachable) {
    throw new Error(`Search unreachable: ${health.error ?? "unknown"}`)
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result = await reindexAllProducts(query)
  logger.info(`Search sync complete: indexed ${result.indexed} published products`)
}
