import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { ProductRail } from "@/components/commerce/product-grid"
import { SectionHeader } from "@/components/commerce/section-header"
import { qk } from "@/hooks/use-store"
import { getStoreProduct } from "@/lib/products"
import { readRecentlyViewed } from "@/lib/recently-viewed"

/** Products this device opened recently (ids only are stored locally). */
export function RecentlyViewed({ excludeId, title = "Recently viewed" }: { excludeId?: string; title?: string }) {
  const [ids] = useState(() => readRecentlyViewed().filter((id) => id !== excludeId).slice(0, 10))
  const qs = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.product(id),
      queryFn: () => getStoreProduct(id),
      staleTime: 300_000,
      retry: false,
    })),
  })
  const products = qs.flatMap((q) => (q.data ? [q.data] : []))
  if (ids.length === 0 || (products.length === 0 && !qs.some((q) => q.isLoading))) return null
  return (
    <section className="container-page" aria-label={title}>
      <SectionHeader title={title} />
      <ProductRail products={products} loading={qs.some((q) => q.isLoading)} label={title} />
    </section>
  )
}
