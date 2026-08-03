/**
 * GET /admin/alkemart/stats — ops snapshot (order count, GMV by currency, catalog).
 * Admin-authenticated only.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  collectCommerceStats,
  statsFromSearchHits,
} from "../../../../lib/commerce-stats.ts"
import { isSearchEnabled } from "../../../../lib/search/client.ts"
import { searchProducts } from "../../../../lib/search/service.ts"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const raw = await collectCommerceStats(query, {
      searchEnabled: isSearchEnabled(),
    })

    const flat = {
      total_orders: raw.orders.total,
      total_gmv_ghs: raw.orders.gmv_by_currency?.ghs ?? 0,
      active_sellers: raw.sellers.open,
      catalog_size: raw.products.published,
      gmv_last_30_days: raw.series.days.map((d) => ({
        date: d.date,
        amount: d.gmv,
      })),
    }

    if (isSearchEnabled()) {
      try {
        const sample = await searchProducts({ q: "", limit: 100 })
        const breakdown = statsFromSearchHits(sample.hits)
        res.status(200).json({ ...flat, search_index: breakdown })
        return
      } catch {
        /* fall through with base stats */
      }
    }

    res.status(200).json(flat)
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to collect stats",
    })
  }
}
