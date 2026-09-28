import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { MerchEmpty } from "@workspace/ui"
import { ProductCard } from "@/components/product/ProductCard"
import { ProductGridSkeleton } from "@/components/skeletons"
import { listStoreProducts } from "@/lib/products"
import { getMarketCountry } from "@/design/market"

export type SearchRouteSearch = {
  q?: string
  deals?: string
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    deals: typeof search.deals === "string" ? search.deals : undefined,
  }),
  component: SearchPage,
})

function SearchPage() {
  const { q, deals } = Route.useSearch()
  const productsQ = useQuery({
    queryKey: ["store", "search", q, deals],
    queryFn: () =>
      listStoreProducts({
        limit: 24,
        q: q?.trim() || undefined,
        sort: deals === "1" ? "newest" : undefined,
      }),
  })
  const products = productsQ.data?.products ?? []

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {deals === "1" ? "Best offers" : q ? `Results for “${q}”` : "Search"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {`Find products with the best price across ${getMarketCountry()} sellers.`}
        </p>
      </header>

      {productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

      {!productsQ.isLoading && products.length === 0 ? (
        <MerchEmpty
          title="No matching products"
          body="Try another search. We do not fill this grid with unrelated catalogue."
        />
      ) : null}

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
