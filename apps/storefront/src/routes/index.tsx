import { useEffect, useMemo, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  CategoryMosaic,
  HomeAdvertiseBand,
  HomeDeliveryBand,
  HomeHowItWorks,
  HomeLastOffers,
} from "@/components/home"
import { getMercurVendorUrl } from "@/lib/env"
import { trackHomepageViewed } from "@/lib/analytics"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { resolveMosaicCategories } from "@/lib/catalog-nav"

const HOME_OFFERS_TARGET = 14

export const Route = createFileRoute("/")({
  component: HomePage,
})

/**
 * Homepage — real catalog only (production).
 * No demo seed, no invented products or categories.
 */
function HomePage() {
  const tracked = useRef(false)

  const productsQ = useQuery({
    queryKey: ["store", "products", "home", HOME_OFFERS_TARGET],
    queryFn: () => listStoreProducts({ limit: HOME_OFFERS_TARGET }),
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
  })

  const mosaic = useMemo(
    () => resolveMosaicCategories(catsQ.data ?? []),
    [catsQ.data],
  )

  const featured = useMemo(
    () => productsQ.data?.products ?? [],
    [productsQ.data?.products],
  )

  const sellUrl = useMemo(() => {
    try {
      return getMercurVendorUrl()
    } catch {
      return ""
    }
  }, [])

  const loadingOffers = productsQ.isLoading && featured.length === 0

  useEffect(() => {
    if (tracked.current) return
    if (productsQ.isLoading || catsQ.isLoading) return
    tracked.current = true
    trackHomepageViewed({
      productCount: featured.length,
      categoryCount: mosaic.length,
      sellerCount: new Set(
        featured.map((p) => p.seller?.handle).filter(Boolean),
      ).size,
      hasFeatured: featured.length > 0,
    })
  }, [
    productsQ.isLoading,
    catsQ.isLoading,
    featured.length,
    mosaic.length,
  ])

  return (
    <div className="space-y-10 pb-4 sm:space-y-12">
      {mosaic.length > 0 ? (
        <CategoryMosaic categories={mosaic} limit={4} />
      ) : null}
      <HomeLastOffers products={featured} loading={loadingOffers} />
      {!loadingOffers && featured.length === 0 && mosaic.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No listings yet.{" "}
          <a
            className="font-semibold text-primary underline-offset-2 hover:underline"
            href={sellUrl || "/sell"}
          >
            Start selling
          </a>
        </p>
      ) : null}
      <HomeDeliveryBand />
      <HomeHowItWorks />
      <HomeAdvertiseBand ctaHref={sellUrl || undefined} ctaTo="/sell" />
    </div>
  )
}
