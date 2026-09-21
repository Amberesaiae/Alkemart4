import { useEffect, useMemo, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HomepageSections, HomepageSkeleton } from "@/components/home"
import { PageSeo } from "@/components/page-seo"
import { trackHomepageViewed } from "@/lib/analytics"
import { DEFAULT_STORE_CATEGORIES, DEMO_CATALOG_PRODUCTS, fetchFeaturedProducts, listStoreCategories } from "@/lib/products"
import { fetchHomepageSections } from "@/lib/homepage"
import { resolveMosaicTiles } from "@/lib/catalog-nav"
import { DEFAULT_HOMEPAGE_SECTIONS, composeMarketCourse } from "@alkemart/shared/homepage"
import {
  absoluteUrl,
  defaultDescription,
  organizationJsonLd,
  siteOrigin,
} from "@/lib/seo"

export const Route = createFileRoute("/")({
  component: HomePage,
})

/**
 * Homepage — marketing course, not a CMS dump.
 * Departments (goods first) → most ordered → multi-seller proof → shop rail.
 */
function HomePage() {
  const tracked = useRef(false)

  // No placeholder data: while this resolves, the merchandising shelves render
  // their own shimmer skeletons. Seeding it with the stand-in catalogue made
  // every shelf flash the same six images and then swap them out.
  const featuredQ = useQuery({
    queryKey: ["store", "featured-products"],
    queryFn: () => fetchFeaturedProducts(),
    staleTime: 120_000,
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    initialData: DEFAULT_STORE_CATEGORIES,
    staleTime: 5 * 60_000,
  })
  const homepageQ = useQuery({
    queryKey: ["store", "homepage-content"],
    queryFn: fetchHomepageSections,
    initialData: DEFAULT_HOMEPAGE_SECTIONS,
    staleTime: 60_000,
  })

  // An empty catalogue response (API hiccup) must not blank discovery —
  // fall back to the default departments, same spirit as the DEMO products.
  const effectiveCats =
    (catsQ.data?.length ?? 0) > 0 ? catsQ.data! : DEFAULT_STORE_CATEGORIES

  const mosaic = useMemo(
    () => resolveMosaicTiles(effectiveCats),
    [effectiveCats],
  )

  const featured = useMemo(
    () => {
      const live = featuredQ.data ?? []
      if (live.length > 0) return live
      // The local visual-review environment can run without its Worker API.
      // Keep production honest; only development receives the documented
      // catalogue fixtures needed to inspect the merchandising hierarchy.
      return import.meta.env.DEV ? DEMO_CATALOG_PRODUCTS : []
    },
    [featuredQ.data],
  )

  const loadingOffers = featuredQ.isLoading && featured.length === 0
  const managedSections = useMemo(
    () => composeMarketCourse(homepageQ.data ?? []),
    [homepageQ.data],
  )

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
      {homepageQ.isLoading ? (
        <HomepageSkeleton />
      ) : (
        <HomepageSections
          sections={managedSections}
          categories={effectiveCats}
          products={featured}
          productsLoading={featuredQ.isLoading}
        />
      )}
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
    </div>
  )
}
