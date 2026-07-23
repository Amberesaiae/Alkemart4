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
import { PageSeo } from "@/components/page-seo"
import { Skeleton } from "@/components/skeleton"
import { getMercurVendorUrl } from "@/lib/env"
import { trackHomepageViewed } from "@/lib/analytics"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { resolveMosaicCategories } from "@/lib/catalog-nav"
import {
  absoluteUrl,
  defaultDescription,
  organizationJsonLd,
  siteOrigin,
} from "@/lib/seo"
import { cn } from "@/lib/utils"

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
    staleTime: 60_000,
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
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

  const origin = siteOrigin()
  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      {
        "@type": "WebSite",
        name: "alkemart",
        url: origin || absoluteUrl("/"),
        description: defaultDescription(),
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${origin || ""}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  }

  return (
    <div className="space-y-8 pb-4 sm:space-y-10">
      <PageSeo
        title="Market"
        description={defaultDescription()}
        path="/"
        jsonLd={homeJsonLd}
      />
      {catsQ.isLoading && mosaic.length === 0 ? (
        <div
          className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:grid-rows-2 lg:h-[min(440px,50vw)] lg:min-h-[420px]"
          role="status"
          aria-label="Loading categories"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "w-full rounded-xl aspect-[5/4] sm:aspect-[4/3]",
                i < 2 && "lg:row-span-2 lg:h-full lg:aspect-auto",
              )}
            />
          ))}
        </div>
      ) : null}
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
