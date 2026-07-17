import { getBackendUrl, getPublishableKey } from "./env"

export type StoreVendor = {
  id: string
  name: string
  slug: string
  bio?: string | null
}

/**
 * List marketplace vendors when the store exposes them.
 * Empty array if endpoint missing or empty — never invents sellers.
 */
export async function listStoreVendors(): Promise<StoreVendor[]> {
  const base = getBackendUrl()
  const pk = getPublishableKey()
  const paths = [
    `${base}/store/alkemart/vendors`,
    `${base}/store/sellers`,
  ]

  for (const url of paths) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "x-publishable-api-key": pk,
        },
      })
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, unknown>
      const raw =
        (data.vendors as Record<string, unknown>[] | undefined) ??
        (data.sellers as Record<string, unknown>[] | undefined) ??
        (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])
      const mapped: StoreVendor[] = []
      for (const v of raw) {
        const id = String(v.id ?? "")
        const name = typeof v.name === "string" ? v.name.trim() : ""
        const slug =
          typeof v.slug === "string"
            ? v.slug
            : typeof v.handle === "string"
              ? v.handle
              : ""
        if (!id || !name || !slug) continue
        mapped.push({
          id,
          name,
          slug,
          bio: typeof v.bio === "string" ? v.bio : null,
        })
      }
      if (mapped.length) return mapped
    } catch {
      /* try next path */
    }
  }
  return []
}
