import { getAlkemartApiUrl } from "./env"

/**
 * Definition-backed facets with server counts (`GET /store/catalog/facets`).
 *
 * Counts come from the API, never recomputed in the browser: a count derived
 * from the current page would contradict itself the moment results paginate.
 * `attributes` is empty until an admin publishes attribute definitions and
 * profiles, which is the honest state — an empty group renders as nothing
 * rather than as a filter that matches everything.
 */
export type CatalogFacets = {
  categoryId: string | null
  priceMinPesewas: string | null
  priceMaxPesewas: string | null
  availabilityCount: number
  conditions: Record<string, number>
  attributes: { code: string; label: string; values: Record<string, number> }[]
}

const EMPTY: CatalogFacets = {
  categoryId: null,
  priceMinPesewas: null,
  priceMaxPesewas: null,
  availabilityCount: 0,
  conditions: {},
  attributes: [],
}

/** Resolves to empty rather than throwing: filters are an enhancement. */
export async function fetchCatalogFacets(
  category?: string,
  signal?: AbortSignal,
): Promise<CatalogFacets> {
  const base = getAlkemartApiUrl()
  if (!base) return EMPTY
  const url = new URL(`${base.replace(/\/$/, "")}/store/catalog/facets`)
  if (category && category !== "all") url.searchParams.set("category", category)
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal })
    if (!res.ok) return EMPTY
    const raw = (await res.json()) as Partial<CatalogFacets>
    return {
      ...EMPTY,
      ...raw,
      conditions: raw.conditions ?? {},
      attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
    }
  } catch {
    return EMPTY
  }
}
