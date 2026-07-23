/**
 * CLI: print commerce stats snapshot
 *   medusa exec ./src/scripts/print-commerce-stats.ts
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  collectCommerceStats,
  statsFromSearchHits,
} from "../lib/commerce-stats"
import { isSearchEnabled } from "../lib/search/client"
import { searchProducts } from "../lib/search/service"

export default async function printCommerceStats({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const stats = await collectCommerceStats(query, {
    searchEnabled: isSearchEnabled(),
  })

  if (isSearchEnabled()) {
    try {
      const sample = await searchProducts({ q: "", limit: 100 })
      stats.search = {
        enabled: true,
        indexed_hint: sample.estimatedTotalHits,
      }
      const breakdown = statsFromSearchHits(sample.hits)
      logger.info(JSON.stringify({ ...stats, search_index: breakdown }, null, 2))
      return
    } catch (e) {
      logger.warn(
        `Search sample failed: ${e instanceof Error ? e.message : e}`,
      )
    }
  }

  logger.info(JSON.stringify(stats, null, 2))
}
