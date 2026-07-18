import { listOperatingMarkets } from "./markets"

/**
 * Country codes currently in operation (admin-gated via regions).
 * Prefer markets API so currency + locale stay aligned with country.
 */
export async function listRegionCountryCodes(): Promise<string[]> {
  const { markets } = await listOperatingMarkets()
  if (!markets.length) {
    throw new Error(
      "No operating countries. In Admin → Settings → Regions, attach a country to a region.",
    )
  }
  return markets.map((m) => m.country_code)
}
