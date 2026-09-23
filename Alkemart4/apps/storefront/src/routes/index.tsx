import { useEffect, useMemo, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HomepageSections, HomepageSkeleton } from "@/components/home"
import { CampaignCourse } from "@/components/home/CampaignCourse"
import { assignBucket, fetchCourse, orderShelvesForBucket } from "@/lib/course"
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
  /**
   * Resolved campaign course (Phase 5C): live placements + rule shelves.
   * Failure collapses to nothing — the JSON course below stays the fallback.
   */
  const courseQ = useQuery({
    queryKey: ["store", "homepage-course"],
    queryFn: fetchCourse,
    staleTime: 60_000,
    retry: false,
  })
  /**
   * Phase 7D `homepage-shelf-order` test: exposed units see trending first.
   * Absent/unknown experiments answer control — the shelf order stays put.
   */
  const bucketQ = useQuery({
    queryKey: ["store", "experiment", "homepage-shelf-order"],
    queryFn: () => assignBucket("homepage-shelf-order"),
    staleTime: 300_000,
    retry: false,
  })
  const course = useMemo(() => {
    const base = courseQ.data ?? null
    if (!base || bucketQ.data !== "exposed") return base
    return { ...base, shelves: orderShelvesForBucket(base.shelves, "exposed") }
  }, [courseQ.data, bucketQ.data])

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
  const managedSections = useMemo(() => {
    const all = composeMarketCourse(homepageQ.data ?? [])
    if (!course) return all
    // Single truth per slot (Phase 5C): JSON promo sections whose slot the
    // course fills are skipped, so a campaign and a static block never
    // double-serve the same beat. Shelves are beats, not slots: the course
    // shelves render inside the managed flow (beneath the mosaic) and the
    // product shelves stay, kept distinct by the shared claim pipeline.
    // Editorial sections always render.
    const slotTypes: Record<string, string[]> = {
      hero: ["promo_hero"],
      deal_rail: ["deal_rail"],
      promo_grid: ["promo_grid"],
      promo_band: ["promo_band"],
      marquee: ["marquee"],
    }
    const hidden = new Set<string>()
    for (const p of course.placements) {
      for (const t of slotTypes[p.code] ?? []) hidden.add(t)
    }
    return all.filter((s) => !hidden.has(s.type))
  }, [homepageQ.data, course])

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
        <>
          {course && course.placements.length > 0 ? (
            <CampaignCourse course={course} />
          ) : null}
          <HomepageSections
            sections={managedSections}
            categories={effectiveCats}
            products={featured}
            productsLoading={featuredQ.isLoading}
            courseShelves={course?.shelves ?? []}
          />
        </>
      )}
      {featuredQ.isError && !loadingOffers ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
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
