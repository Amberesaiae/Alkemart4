/**
 * GET /admin/alkemart/stats — ops snapshot (order count, GMV by currency, catalog).
 * Admin-authenticated only.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  collectCommerceStats,
  statsFromSearchHits,
} from "../../../../lib/commerce-stats"
import { isSearchEnabled } from "../../../../lib/search/client"
import { searchProducts } from "../../../../lib/search/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
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
        res.status(200).json({ ...stats, search_index: breakdown })
        return
      } catch {
        /* fall through with base stats */
      }
    }

    res.status(200).json(stats)
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to collect stats",
    })
  }
}
