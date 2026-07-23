/**
 * GET /vendor/alkemart/markets
 *
 * Operating markets (admin-gated regions). Read-only config for Seller Hub
 * onboarding — currency + country + address profile.
 *
 * AUTHENTICATE = false skips Mercur ensureSeller (needs no x-seller-id).
 * Markets are not secrets; same data as /store/alkemart/markets.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listOperatingMarkets } from "../../../../lib/operating-markets"

/** Skip Mercur vendor authenticate + ensureSeller for this route. */
export const AUTHENTICATE = false

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const markets = await listOperatingMarkets(query)
    res.status(200).json({
      markets,
      default_country_code: markets[0]?.country_code ?? null,
      default_currency_code: markets[0]?.currency_code ?? null,
      default_region_id: markets[0]?.region_id ?? null,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to list markets",
    })
  }
}
