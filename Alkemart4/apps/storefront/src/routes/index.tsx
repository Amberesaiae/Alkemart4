import { useEffect, useMemo, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  CategoryMosaic,
  HomeAdvertiseBand,
  HomeHowItWorks,
  HomeLastOffers,
} from "@/components/home"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { PageSeo } from "@/components/page-seo"
import { Skeleton } from "@/components/skeleton"
import { getMercurVendorUrl } from "@/lib/env"
import { trackHomepageViewed } from "@/lib/analytics"
import { fetchFeaturedProducts, listStoreCategories } from "@/lib/products"
import { resolveMosaicTiles } from "@/lib/catalog-nav"
import {
  absoluteUrl,
  defaultDescription,
  organizationJsonLd,
  siteOrigin,
} from "@/lib/seo"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({
  component: HomePage,
})

/**
 * Homepage — real catalog only (production).
 * No demo seed, no invented products or categories.
 * Rails: newest listings first (honest curation), then per-category tabs.
 */
function HomePage() {
  const tracked = useRef(false)

  const featuredQ = useQuery({
    queryKey: ["store", "featured-products"],
    queryFn: () => fetchFeaturedProducts(),
    staleTime: 120_000,
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })

  const mosaic = useMemo(
    () => resolveMosaicTiles(catsQ.data ?? []),
    [catsQ.data],
  )

  const featured = useMemo(
    () => featuredQ.data ?? [],
    [featuredQ.data],
  )

  const sellUrl = useMemo(() => {
    try {
      return getMercurVendorUrl()
    } catch {
      return ""
    }
  }, [])

  const loadingOffers = featuredQ.isLoading && featured.length === 0

  useEffect(() => {
    if (tracked.current) return
    if (featuredQ.isLoading || catsQ.isLoading) return
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
    featuredQ.isLoading,
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
        <CategoryMosaic tiles={mosaic} />
      ) : null}

      {featuredQ.data && featured.length > 0 ? (
        <section aria-label="Fresh picks — newest products" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="type-section text-foreground">Fresh picks</h2>
            <p className="type-sm text-muted-foreground">
              Just landed from our sellers
            </p>
          </div>
          <ProductGridShell>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} size="tile" />
            ))}
          </ProductGridShell>
        </section>
      ) : null}

      {/* Only when there is something to show — an empty rail would contradict
          the catalog (honesty rule: no fake emptiness claims). */}
      {featured.length > 0 ? (
        <HomeLastOffers
          products={featured}
          categories={catsQ.data ?? []}
          loading={loadingOffers}
        />
      ) : null}
      {featuredQ.isError && !loadingOffers ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn't load the market just now.
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => void featuredQ.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}
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
      <HomeHowItWorks />
      <HomeAdvertiseBand ctaHref={sellUrl || undefined} ctaTo="/sell" />
    </div>
  )
}
