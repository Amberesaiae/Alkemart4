import { getAlkemartApiUrl, getBackendUrl, getPublishableKey } from "./env"
import { getSellerShop, setBaseUrl } from "./api-client"

function ensureWorkersBaseUrl() {
  const url = getAlkemartApiUrl()
  if (!url) throw new Error("VITE_ALKEMART_API_URL is not set")
  setBaseUrl(url)
}

export type StoreVendor = {
  id: string
  name: string
  slug: string
  bio?: string | null
}

function useWorkersVendors(): boolean {
  return Boolean(getAlkemartApiUrl())
}

/**
 * List marketplace vendors when the store exposes them.
 * Empty array if endpoint missing or empty — never invents sellers.
 */
export async function listStoreVendors(): Promise<StoreVendor[]> {
  if (useWorkersVendors()) {
    ensureWorkersBaseUrl()
    const base = getAlkemartApiUrl()
    try {
      const res = await fetch(`${base}/store/sellers`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) return []
      const data = (await res.json()) as Record<string, unknown>
      const raw =
        (data.sellers as Record<string, unknown>[] | undefined) ??
        (data.items as Record<string, unknown>[] | undefined) ??
        []
      const mapped: StoreVendor[] = []
      for (const v of raw) {
        const id = String(v.id ?? "")
        const name = typeof v.name === "string" ? v.name.trim() : ""
        const slug =
          typeof v.handle === "string"
            ? v.handle
            : typeof v.slug === "string"
              ? v.slug
              : ""
        if (!id || !name || !slug) continue
        mapped.push({ id, name, slug, bio: null })
      }
      return mapped
    } catch {
      return []
    }
  }

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

export type StoreVendorDetail = {
  id: string
  name: string
  slug: string
  bio?: string | null
  logoImageUrl?: string | null
  coverImageUrl?: string | null
  logoThumbUrl?: string | null
  logoWebUrl?: string | null
  coverThumbUrl?: string | null
  coverWebUrl?: string | null
  ratingAvgX100?: number
  ratingCount?: number
  badgeTopSeller?: boolean
  badgeFastShipper?: boolean
  status?: string
}

/** Shop hero for /shops/$slug — Workers seller shop or Medusa alkemart vendor. */
export async function getStoreVendorBySlug(slug: string): Promise<{
  vendor: StoreVendorDetail
}> {
  if (useWorkersVendors()) {
    ensureWorkersBaseUrl()
    try {
      const shop = await getSellerShop(slug)
      return {
        vendor: {
          id: shop.seller.id,
          name: shop.seller.name,
          slug: shop.seller.handle,
          bio: null,
        },
      }
    } catch {
      throw new Error("Store not found")
    }
  }

  const base = getBackendUrl()
  const pk = getPublishableKey()
  const res = await fetch(
    `${base}/store/alkemart/vendors/${encodeURIComponent(slug)}`,
    {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    },
  )
  if (res.status === 404) throw new Error("Store not found")
  if (!res.ok) throw new Error(`Failed to load store (${res.status})`)
  const data = (await res.json()) as { vendor?: Partial<StoreVendorDetail> & { id?: string; name?: string } }
  if (!data.vendor?.id || !data.vendor.name) throw new Error("Store not found")
  return {
    vendor: {
      ...data.vendor,
      id: String(data.vendor.id),
      name: data.vendor.name,
      slug: data.vendor.slug ?? slug,
      bio: data.vendor.bio ?? null,
    },
  }
}
