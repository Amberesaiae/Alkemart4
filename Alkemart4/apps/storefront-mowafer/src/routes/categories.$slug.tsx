import { useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button, MerchEmpty } from "@workspace/ui"
import { ProductCard } from "@/components/product/ProductCard"
import { FilterSkeleton, ProductGridSkeleton } from "@/components/skeletons"
import { ListingHero, listingHeroArt, listingHeroTitle } from "@/components/listing/ListingHero"
import {
  ListingFilterStrip,
  type ListingFacetState,
  type ListingViewMode,
} from "@/components/listing/ListingFilterStrip"
import { ListingSidePanels } from "@/components/listing/ListingSidePanels"
import { ListingLayout } from "@/components/listing/ListingLayout"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { resolveBrowseCategory, resolveRailCategories } from "@/lib/catalog-nav"
import { cardRating } from "@/lib/product-rating"

export const Route = createFileRoute("/categories/$slug")({
  component: BrowsePage,
})

const PAGE = 24

function BrowsePage() {
  const { slug } = Route.useParams()
  const isAll = slug === "all" || slug === ""
  const [limit, setLimit] = useState(PAGE)
  const [viewMode, setViewMode] = useState<ListingViewMode>("grid")
  const [selectedSellers, setSelectedSellers] = useState<string[]>([])
  const [facets, setFacets] = useState<ListingFacetState>({
    subCategory: "all",
    minRating: 0,
    priceMin: 0,
    priceMax: 0,
  })

  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })
  const category = resolveBrowseCategory(catsQ.data ?? [], slug)
  const categoryHandle = isAll ? undefined : (category?.handle || slug)

  const productsQ = useQuery({
    queryKey: ["store", "products", categoryHandle, limit],
    queryFn: () =>
      listStoreProducts({
        limit,
        categoryHandle,
      }),
  })

  const products = productsQ.data?.products ?? []
  const count = productsQ.data?.count ?? products.length
  // Appending shimmer: limit bumps refetch in background — keep the grid
  // mounted and prove the fetch with trailing skeletons + pending CTA.
  const appending = productsQ.isFetching && !productsQ.isLoading
  const rail = resolveRailCategories(catsQ.data ?? [])

  const priceBounds = useMemo(() => {
    const amounts = products.map((p) => p.amount).filter((n): n is number => n != null && Number.isFinite(n))
    if (!amounts.length) return { min: 0, max: 100 }
    return { min: Math.floor(Math.min(...amounts)), max: Math.ceil(Math.max(...amounts)) }
  }, [products])

  const effectiveFacets =
    facets.priceMax === 0 && priceBounds.max > 0
      ? { ...facets, priceMin: priceBounds.min, priceMax: priceBounds.max }
      : facets

  const ratingAvailable = products.some((p) => cardRating(p.ratingAvg, p.ratingCount))

  const subCategories = useMemo(() => {
    if (!category) return []
    return (catsQ.data ?? [])
      .filter((c) => c.parentCategoryId === category.id)
      .map((c) => ({ id: c.id, label: c.name }))
  }, [catsQ.data, category])

  const sellers = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) {
      const handle = p.seller?.handle?.trim()
      const name = p.seller?.name?.trim()
      if (handle && name) map.set(handle, name)
    }
    return [...map.entries()].map(([handle, name]) => ({ handle, name }))
  }, [products])

  const visible = products.filter((p) => {
    if (selectedSellers.length && !selectedSellers.includes(p.seller?.handle ?? "")) return false
    if (effectiveFacets.minRating > 0) {
      const r = cardRating(p.ratingAvg, p.ratingCount)
      if (!r || Number(r.value) < effectiveFacets.minRating) return false
    }
    if (p.amount != null && (p.amount < effectiveFacets.priceMin || p.amount > effectiveFacets.priceMax)) {
      return false
    }
    if (effectiveFacets.subCategory !== "all") {
      const sub = (catsQ.data ?? []).find((c) => c.id === effectiveFacets.subCategory)
      const handle = sub?.handle?.toLowerCase()
      if (handle && !(p.categoryHandles ?? []).includes(handle)) return false
    }
    return true
  })

  const departmentName = isAll ? "All products" : category?.name || slug
  const title = listingHeroTitle(departmentName, isAll)

  return (
    <ListingLayout
      departmentLabel={departmentName}
      hero={
        <ListingHero
          title={title}
          body={isAll ? "Compare multi-seller prices on alkemart." : `Shop ${departmentName.toLowerCase()} — compare offers.`}
          imageSrc={listingHeroArt(slug)}
        />
      }
      filterStrip={
        <ListingFilterStrip
          departmentLabel={departmentName}
          subCategories={subCategories}
          ratingAvailable={ratingAvailable}
          priceBounds={priceBounds}
          state={effectiveFacets}
          onChange={setFacets}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      }
      sidebar={
        <ListingSidePanels
          department={isAll ? "all" : (category?.handle || slug)}
          departmentName={departmentName}
          categories={rail}
          sellers={sellers}
          selectedSellers={selectedSellers}
          onToggleSeller={(handle) =>
            setSelectedSellers((cur) =>
              cur.includes(handle) ? cur.filter((h) => h !== handle) : [...cur, handle],
            )
          }
        />
      }
    >
      {productsQ.isLoading ? (
        <div className="space-y-4">
          <FilterSkeleton />
          <ProductGridSkeleton count={12} view={viewMode} />
        </div>
      ) : null}

      {!productsQ.isLoading && visible.length === 0 ? (
        <MerchEmpty
          title="No products in this department"
          body="Nothing matches these filters from the live catalog."
        />
      ) : null}

      {visible.length > 0 ? (
        <div
          className={
            viewMode === "list"
              ? "grid gap-2.5 sm:grid-cols-2"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3"
          }
        >
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} size={viewMode === "list" ? "row" : "tile"} />
          ))}
        </div>
      ) : null}

      {appending ? <ProductGridSkeleton count={6} view={viewMode} /> : null}

      {count > visible.length || (productsQ.data && count > limit) ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setLimit((n) => n + PAGE)}
            disabled={appending}
            isLoading={appending}
          >
            {appending ? "Loading…" : "View More"}
          </Button>
        </div>
      ) : visible.length > 0 ? (
        <div className="flex justify-center">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/categories/$slug" params={{ slug: "all" }}>
              View More
            </Link>
          </Button>
        </div>
      ) : null}
    </ListingLayout>
  )
}
