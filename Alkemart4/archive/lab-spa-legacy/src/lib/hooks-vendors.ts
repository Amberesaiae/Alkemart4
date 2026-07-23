import { useQuery } from "@tanstack/react-query"
import { useMedusa } from "./medusa-provider"
import { requiredEnv } from "./medusa/client"

export type AlkemartVendorStore = {
  id: string
  slug: string
  name: string
  bio: string | null
  logoImageUrl: string | null
  ratingAvgX100: number
  ratingCount: number
  badgeTopSeller: boolean
  badgeFastShipper: boolean
  status: string
}

function backendUrl(): string {
  try {
    return requiredEnv("VITE_MEDUSA_BACKEND_URL").replace(/\/$/, "")
  } catch {
    return "http://localhost:9000"
  }
}

export function useGetVendorBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["medusa", "vendor", slug],
    enabled: Boolean(slug),
    retry: false,
    throwOnError: false,
    queryFn: async (): Promise<AlkemartVendorStore> => {
      const pk = requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
      const res = await fetch(
        `${backendUrl()}/store/alkemart/vendors/${encodeURIComponent(slug!)}`,
        {
          headers: {
            Accept: "application/json",
            "x-publishable-api-key": pk,
          },
        },
      )
      if (res.status === 404) {
        throw new Error("Store not found")
      }
      if (!res.ok) {
        throw new Error(`Failed to load store (${res.status})`)
      }
      const data = (await res.json()) as { vendor: AlkemartVendorStore }
      return data.vendor
    },
  })
}
