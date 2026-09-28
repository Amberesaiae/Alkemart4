import { useEffect, useMemo, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  MARKET_DEPARTMENT_ORDER,
  composeMarketCourse,
  visibleSections,
  type HomeSection,
} from "@alkemart/shared/homepage"
import { HomeHero } from "@/components/home/home-hero"
import type { HeroPhoto } from "@/components/home/hero-photos"
import { REFERENCE_DEPARTMENTS, referenceDepartmentCategory } from "@/components/home/reference-departments"
import { DepartmentRow } from "@/components/home/department-row"
import { HomeRows, SeeAllProducts, useHomeDiscovery } from "@/components/home/discovery"
import { ShelfSection } from "@/components/home/shelf-section"
import { CompareShowcase } from "@/components/home/compare-showcase"
import { COMPARE_ENABLED } from "@/lib/features"
import { PromoSection } from "@/components/home/promo-section"
import { CampaignPlacements } from "@/components/home/campaign-placements"
import { StoreRailSection } from "@/components/home/store-rail-section"
import { TrustPanel } from "@/components/commerce/trust-strip"
import { ProductRail } from "@/components/commerce/product-grid"
import { SectionHeader } from "@/components/commerce/section-header"
import { RecentlyViewed } from "@/components/commerce/recently-viewed"
import { ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useCategories } from "@/hooks/use-store"
import { fetchFeaturedProducts, type StoreCategory, type StoreProductCard } from "@/lib/products"
import { fetchHomepageSections } from "@/lib/homepage"
import { listStoreVendors } from "@/lib/vendors"
import { assignBucket, fetchCourse, orderShelvesForBucket } from "@/lib/course"
import { trackHomepageViewed } from "@/lib/analytics"
import { absoluteUrl, defaultDescription, organizationJsonLd, siteOrigin } from "@/lib/seo"

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { preview?: string } => (typeof s.preview === "string" && s.preview.startsWith("pv1.") ? { preview: s.preview } : {}),
  component: HomePage,
})

/** Top-level departments in buyer order: goods first, then the rest by rank. */

// Keeps the first home screen useful during a catalog/API outage. These are
// navigation labels only; product and shop content remains API-backed.
const HOME_DEPARTMENT_FALLBACK: StoreCategory[] = [
  { id: "phones-electronics", handle: "phones-electronics", name: "Phones & Electronics", rank: 0 },
  { id: "fashion-apparel", handle: "fashion-apparel", name: "Fashion & Apparel", rank: 1 },
  { id: "home-living", handle: "home-living", name: "Home & Living", rank: 2 },
  { id: "health-beauty", handle: "health-beauty", name: "Health & Beauty", rank: 3 },
  { id: "food-groceries", handle: "food-groceries", name: "Food & Groceries", rank: 4 },
  { id: "baby-kids", handle: "baby-kids", name: "Baby & Kids", rank: 5 },
]

function orderDepartments(all: StoreCategory[]): StoreCategory[] {
  const tops = all.filter((c) => !c.parentCategoryId)
  const idx = (c: StoreCategory) => {
    const i = (MARKET_DEPARTMENT_ORDER as readonly string[]).indexOf((c.handle ?? "").toLowerCase())
    return i === -1 ? 100 + (c.rank ?? 0) : i
  }
  return [...tops].sort((a, b) => idx(a) - idx(b))
}

/**
 * Phone hero photos, all backed by something live: open shops with a cover
 * and listings, alternating with departments that have stock (their studio
 * photo). Nothing appears until stock is known.
 */
function heroPhotos(shops: Awaited<ReturnType<typeof listStoreVendors>>, categories: StoreCategory[], stocked: Set<string> | null): HeroPhoto[] {
  const live = shops
    .filter((v) => v.availability !== "paused" && v.banner && (v.featured?.length ?? 0) > 0)
    .map((v) => ({ key: `shop-${v.slug}`, image: v.banner!, caption: v.name, href: `/shops/${v.slug}` }))
  const depts = stocked
    ? REFERENCE_DEPARTMENTS.flatMap((d) => {
        const c = referenceDepartmentCategory(d.id, categories)
        if (!c || !stocked.has(c.id)) return []
        return [{ key: `dept-${d.id}`, image: `/images/departments/reference-${d.id}-${d.id === "fashion" ? "v2" : "v1"}.webp`, caption: `Shop ${d.short}`, href: `/categories/${c.handle ?? c.id}` }]
      })
    : []
  const out: HeroPhoto[] = []
  for (let i = 0; i < Math.max(live.length, depts.length); i++) {
    if (live[i]) out.push(live[i])
    if (depts[i]) out.push(depts[i])
  }
  return out.slice(0, 8)
}

/**
 * Homepage course:
 *   brand hero → promises → departments (studio art) → decision shelf →
 *   multi-seller proof → campaign beat → paid placements → proof shelf →
 *   shops → recently viewed → sell CTA.
 * The managed beats come from the homepage studio via composeMarketCourse.
 */
function HomePage() {
  const tracked = useRef(false)
  const categoriesQ = useCategories()
  const featuredQ = useQuery({
    queryKey: ["store", "featured-products"],
    queryFn: fetchFeaturedProducts,
    staleTime: 120_000,
  })
  const { preview } = Route.useSearch()
  const homepageQ = useQuery({
    queryKey: ["store", "homepage-content", preview ?? "live"],
    queryFn: () => fetchHomepageSections(preview),
    placeholderData: DEFAULT_HOMEPAGE_SECTIONS,
    staleTime: 60_000,
  })
  const shopsQ = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  const courseQ = useQuery({ queryKey: ["store", "homepage-course"], queryFn: fetchCourse, staleTime: 60_000, retry: false })
  const bucketQ = useQuery({
    queryKey: ["store", "experiment", "homepage-shelf-order"],
    queryFn: () => assignBucket("homepage-shelf-order"),
    staleTime: 300_000,
    retry: false,
  })

  const departments = useMemo(
    () => orderDepartments(categoriesQ.data?.length ? categoriesQ.data : HOME_DEPARTMENT_FALLBACK),
    [categoriesQ.data],
  )
  const featured = useMemo(() => featuredQ.data ?? [], [featuredQ.data])
  const course = useMemo(() => {
    const base = courseQ.data
    if (!base) return null
    return bucketQ.data === "exposed" ? { ...base, shelves: orderShelvesForBucket(base.shelves, "exposed") } : base
  }, [courseQ.data, bucketQ.data])

  // One truth per slot: a course placement replaces the studio block it fills.
  const beats = useMemo(() => {
    const all = composeMarketCourse(homepageQ.data ?? [])
    if (!course) return all
    const slot: Record<string, HomeSection["type"][]> = {
      hero: ["promo_hero"],
      deal_rail: ["deal_rail"],
      promo_grid: ["promo_grid"],
      promo_band: ["promo_band"],
      marquee: ["marquee"],
    }
    const hidden = new Set(course.placements.flatMap((p) => slot[p.code] ?? []))
    return all.filter((s) => !hidden.has(s.type))
  }, [homepageQ.data, course])

  useEffect(() => {
    if (tracked.current || featuredQ.isLoading || categoriesQ.isLoading) return
    tracked.current = true
    trackHomepageViewed({
      productCount: featured.length,
      categoryCount: departments.length,
      sellerCount: new Set(featured.map((p) => p.seller?.handle).filter(Boolean)).size,
      hasFeatured: featured.length > 0,
    })
  }, [featuredQ.isLoading, categoriesQ.isLoading, featured, departments.length])

  const origin = siteOrigin()
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      {
        "@type": "WebSite",
        name: "alkemart",
        url: origin || absoluteUrl("/"),
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  }

  // The studio course has fixed roles (composeMarketCourse); read them by type.
  type S<T extends HomeSection["type"]> = Extract<HomeSection, { type: T }>
  const department = beats.find((s): s is S<"category_grid"> => s.type === "category_grid")
  const shelves = beats.filter((s): s is S<"product_shelf" | "deal_rail"> => s.type === "product_shelf" || s.type === "deal_rail")
  const decision = shelves[0]
  const proof = shelves[1]
  const shops = beats.find((s): s is S<"store_rail"> => s.type === "store_rail")
  type Promo = S<"promo_hero" | "promo_band" | "promo_grid" | "countdown_banner" | "marquee" | "value_grid">
  const isPromo = (s: HomeSection): s is Promo =>
    ["promo_hero", "promo_band", "promo_grid", "countdown_banner", "marquee", "value_grid"].includes(s.type)
  const campaign = beats.find(isPromo)
  // Our own ads: every other live studio promo runs further down the page.
  const houseAds = visibleSections(homepageQ.data ?? []).filter((s): s is Promo => isPromo(s) && s.id !== campaign?.id)

  // Products "Fresh picks" already shows; later rows never repeat them.
  const freshShown = decision?.source === "featured" ? featured.slice(0, decision.limit).map((p) => p.id) : []
  const discovery = useHomeDiscovery(categoriesQ.data ?? [], freshShown)

  const photos = useMemo(
    () => heroPhotos(shopsQ.data ?? [], categoriesQ.data ?? [], discovery.stocked),
    [shopsQ.data, categoriesQ.data, discovery.stocked],
  )

  const shared = {
    categories: categoriesQ.data ?? [],
    featured,
    featuredLoading: featuredQ.isLoading,
  }

  return (
    <div className="space-y-8 sm:space-y-16">
      <PageSeo title="Many sellers, one marketplace" description={defaultDescription()} path="/" jsonLd={jsonLd} />
      {preview ? (
        <p role="status" className="sticky top-0 z-50 bg-foreground px-4 py-2 text-center text-sm font-semibold text-background">
          Preview — this draft isn't live. Buyers still see the published homepage.
        </p>
      ) : null}
      {/* The first screen. Desktop: hero, promises and the category row as one
          unit. Phones: a compact hero, then straight into products. */}
      <div>
        <HomeHero
          departments={departments}
          allCategories={categoriesQ.data ?? []}
          stocked={discovery.stocked}
          photos={photos}
          photosLoading={shopsQ.isLoading || discovery.stocked == null}
        />
        <div className="hidden md:block">
          <TrustPanel />
        </div>
        {department ? <DepartmentRow only="desktop" departments={departments} allCategories={categoriesQ.data ?? []} stocked={discovery.stocked} tiles={department.tiles ?? []} className="mt-6" /> : null}
      </div>

      {featuredQ.isError && categoriesQ.isError && departments.length === 0 ? (
        <div className="container-page">
          <ErrorState
            title="The market didn't load"
            error={featuredQ.error}
            onRetry={() => {
              void featuredQ.refetch()
              void categoriesQ.refetch()
            }}
          />
        </div>
      ) : null}

      {decision ? <ShelfSection section={decision} {...shared} /> : null}
      {department ? <DepartmentRow only="phone" title="Shop by department" departments={departments} allCategories={categoriesQ.data ?? []} stocked={discovery.stocked} tiles={department.tiles ?? []} /> : null}
      <HomeRows rows={discovery.top} />
      {COMPARE_ENABLED ? <CompareShowcase products={featured} /> : null}
      {campaign ? <PromoSection section={campaign} /> : null}
      <HomeRows rows={discovery.middle} />
      {course ? <CampaignPlacements course={course} /> : null}
      {proof ? <ShelfSection section={proof} {...shared} /> : null}
      {shops ? <StoreRailSection section={shops} /> : null}
      <HomeRows rows={discovery.bottom} />
      {houseAds.map((s) => (
        <PromoSection key={s.id} section={s} />
      ))}
      {course?.shelves
        // A rule shelf that mostly repeats the featured list adds nothing.
        .filter((s) => {
          const seen = new Set(featured.slice(0, 12).map((p) => p.id))
          return s.cards.filter((c) => seen.has(c.id)).length < s.cards.length / 2
        })
        .map((s) => (
          <ShelfLike key={s.key} title={s.title} products={s.cards} />
        ))}

      <RecentlyViewed />
      <SeeAllProducts />
    </div>
  )
}


/** Rule-backed course shelves arrive already resolved. */
function ShelfLike({ title, products }: { title: string; products: StoreProductCard[] }) {
  if (products.length === 0) return null
  return (
    <section className="container-page" aria-label={title}>
      <SectionHeader title={title} />
      <ProductRail products={products} label={title} />
    </section>
  )
}
