/**
 * GET /store/alkemart/markets
 * Public list of countries currently in operation (from Medusa regions).
 * Forms should bind country → locale (currency, address fields, phone).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listOperatingMarkets } from "../../../../lib/operating-markets"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const markets = await listOperatingMarkets(query)
    res.status(200).json({
      markets,
      /** Convenience: first operating market (usually the primary) */
      default_country_code: markets[0]?.country_code ?? null,
      default_region_id: markets[0]?.region_id ?? null,
      default_currency_code: markets[0]?.currency_code ?? null,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to list markets",
    })
  }
}
