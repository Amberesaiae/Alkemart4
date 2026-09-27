import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"

/** Shop trust facts (rating, location, logo) by handle — cached, never invented. */
export function useVendorDirectory(): Map<string, StoreVendor> {
  const q = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  return useMemo(() => new Map((q.data ?? []).map((v) => [v.slug, v])), [q.data])
}
