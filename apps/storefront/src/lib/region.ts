import { commerceContext, getMedusaClient } from "./medusa"

/** Country codes available on the configured Medusa region (from API). */
export async function listRegionCountryCodes(): Promise<string[]> {
  const sdk = getMedusaClient()
  const { regionId } = commerceContext()
  const { region } = await sdk.store.region.retrieve(regionId)
  const countries = (region as { countries?: { iso_2?: string }[] })?.countries
  if (!Array.isArray(countries) || !countries.length) {
    throw new Error(
      "Region has no countries from store API. Configure the region in Admin.",
    )
  }
  return countries
    .map((c) => (c.iso_2 ?? "").toLowerCase())
    .filter(Boolean)
}
