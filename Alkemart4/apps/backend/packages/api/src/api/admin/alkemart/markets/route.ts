/**
 * GET /admin/alkemart/markets
 * Same operating-market view as store, for ops panels.
 * Enabling a country = attach it to a region in Admin (Settings → Regions).
 * That is the foundational gate — no parallel “countries” table.
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
      guidance: {
        how_to_enable_country:
          "Admin → Settings → Regions: set currency, attach country. That country becomes operable; forms derive currency + address profile from it.",
        acid_note:
          "Region membership is the transactional SoR. Locale profiles are deterministic config keyed by country_code — not a second money geography.",
      },
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to list markets",
    })
  }
}
