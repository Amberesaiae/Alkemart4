import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { CategoryMosaic } from "@/components/home/CategoryMosaic"
import { LastOffers } from "@/components/home/LastOffers"
import { DeliveryBand } from "@/components/home/DeliveryBand"
import { AdvertiseBand } from "@/components/home/AdvertiseBand"
import { fetchFeaturedProducts, listStoreCategories } from "@/lib/products"
import { resolveMosaicTiles } from "@/lib/catalog-nav"

export const Route = createFileRoute("/")({
  component: HomePage,
})

export function HomePage() {
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })
  const offersQ = useQuery({
    queryKey: ["store", "featured"],
    queryFn: () => fetchFeaturedProducts(),
  })

  const tiles = resolveMosaicTiles(catsQ.data ?? [])

  return (
    <div className="space-y-10">
      <CategoryMosaic tiles={tiles} loading={catsQ.isLoading} />
      <LastOffers
        products={offersQ.data ?? []}
        categories={catsQ.data}
        loading={offersQ.isLoading}
      />
      <DeliveryBand />
      <AdvertiseBand />
    </div>
  )
}
