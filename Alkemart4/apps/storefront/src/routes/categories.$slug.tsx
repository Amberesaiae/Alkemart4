import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ErrorAlert } from "@/components/error-alert"
import { LoadMore } from "@/components/load-more"
import { ProductGridSkeleton } from "@/components/skeleton"
import {
  ListingFilters,
  ListingFilterStrip,
  ListingHero,
  ListingLayout,
  filterListingByPrice,
  filterListingByRating,
  filterListingBySellers,
  listingHeroArt,
  listingHeroTitle,
  listingHeroAccent,
  listingHeroBody,
  sortListingProducts,
  type FilterStripState,
  type ListingFilterState,
  type ListingSort,
  type ListingViewMode,
} from "@/components/listing"
import { PageSeo } from "@/components/page-seo"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { searchCatalog } from "@/lib/search"
import { useCloudflareCatalog } from "@/lib/env"
import {
  resolveBrowseCategory,
  resolveRailCategories,
} from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/categories/$slug")({
  validateSearch: (search: Record<string, unknown>) => {
    const seller = parseList(search.seller)
    const sort = parseSort(search.sort)
    return {
      ...(seller.length ? { seller } : {}),
      ...(sort && sort !== "featured" ? { sort } : {}),
    }
  },
  component: BrowsePage,
})

function parseList(v: unknown): string[] {
  if (typeof v === "string" && v.trim()) {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (Array.isArray(v)) {
    return v.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    )
  }
  return []
}

function parseSort(v: unknown): ListingSort | undefined {
  if (
    v === "price_asc" ||
    v === "price_desc" ||
    v === "title" ||
    v === "featured"
  ) {
    return v
  }
  return undefined
}

const PAGE = 24

/**
 * Sub-category chips — real children from the store taxonomy only.
 * Returns [] when a department has no child categories, letting the filter
 * strip omit the subcategory fieldset entirely. Never invents subcategories.
 */
function subCategoriesFor(category: {
  id: string
  handle?: string | null
} | null, all: { id: string; name: string; handle?: string | null; parentCategoryId?: string | null }[]): { id: string; label: string; handle: string | null }[] {
  if (!category) return []
  return all
    .filter((c) => c.parentCategoryId === category.id)
    .map((c) => ({ id: c.id, label: c.name, handle: c.handle ?? null }))
}

/**
 * PLP — Mowafer imgi_11/12 composition.
 * Modules only: ListingHero · ListingFilterStrip · ListingFilters · ProductCard.
 * No inline CSS.
 */
function BrowsePage() {
  const navigate = useNavigate()
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const sellerFilters = search.seller ?? []
  const sort: ListingSort = search.sort ?? "featured"
  const isAll = slug === "all" || slug === ""
  const [limit, setLimit] = useState(PAGE)
  /** Collapsible PLP filters: open on desktop by default, closed on mobile; remember choice. */
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      const stored = sessionStorage.getItem("alkemart.plp.filtersOpen")
      if (stored === "0") return false
      if (stored === "1") return true
    } catch {
      /* private mode */
    }
    return window.matchMedia("(min-width: 1024px)").matches
  })
  const [viewMode, setViewMode] = useState<ListingViewMode>("grid")
  const [priceMin, setPriceMin] = useState<number | null>(null)
  const [priceMax, setPriceMax] = useState<number | null>(null)
  const [minRating, setMinRating] = useState(0)
  const [subCategory, setSubCategory] = useState("all")
  const [location, setLocation] = useState<{
    province: string | null
    city: string | null
  }>({ province: null, city: null })

  useEffect(() => {
    setLimit(PAGE)
    setSubCategory("all")
    setMinRating(0)
    setLocation({ province: null, city: null })
  }, [slug, sellerFilters.join(","), sort])

  const categoriesQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
  })

  const category = !isAll
    ? resolveBrowseCategory(categoriesQ.data ?? [], slug)
    : undefined

  const categoryId = category?.id || undefined
  const categoryHandle = category?.handle ?? (!isAll ? slug : undefined)

  const subCats = useMemo(
    () => subCategoriesFor(category ?? null, categoriesQ.data ?? []),
    [category, categoriesQ.data],
  )

  // Sub-category selects a real child category — refetch the catalog with its
  // exact id/handle (never a client-side text match on invented labels).
  const selectedSub = subCats.find((s) => s.id === subCategory)
  const effectiveCategoryId = selectedSub ? selectedSub.id : categoryId
  const effectiveCategoryHandle = selectedSub
    ? selectedSub.handle ?? selectedSub.id
    : categoryHandle

  const discoveryQ = useQuery({
    queryKey: [
      "store",
      "browse-discovery",
      slug,
      effectiveCategoryHandle,
      sellerFilters.join(","),
      limit,
    ],
    queryFn: () =>
      searchCatalog({
        q: "",
        limit,
        filters: {
          category_handles:
            !isAll && effectiveCategoryHandle
              ? [effectiveCategoryHandle]
              : undefined,
          seller_handles: sellerFilters.length ? sellerFilters : undefined,
        },
      }),
    enabled: isAll || categoriesQ.isSuccess || categoriesQ.isError,
  })

  const useMeili = discoveryQ.data?.engine === "meilisearch"

  const cfCatalog = useCloudflareCatalog()
  const productsQ = useQuery({
    queryKey: [
      "store",
      "products",
      "browse",
      slug,
      effectiveCategoryId,
      effectiveCategoryHandle,
      cfCatalog,
      limit,
    ],
    queryFn: () =>
      listStoreProducts({
        limit: Math.max(limit, 48),
        // Cloudflare catalog filters by handle; Medusa path still uses category id.
        ...(cfCatalog
          ? {
              categoryHandle: isAll ? undefined : effectiveCategoryHandle,
            }
          : {
              categoryId: isAll ? undefined : effectiveCategoryId,
            }),
      }),
    enabled:
      (isAll || categoriesQ.isSuccess || categoriesQ.isError) &&
      (discoveryQ.isSuccess || discoveryQ.isError) &&
      !useMeili,
  })

  const title = isAll
    ? "All products"
    : category?.name ?? (categoriesQ.isLoading ? "…" : "Category")

  const missingCategory = !isAll && categoriesQ.isSuccess && !category

  const rawProducts = useMeili
    ? (discoveryQ.data?.products ?? [])
    : (productsQ.data?.products ?? [])

  const products = useMemo(() => {
    let list = rawProducts
    if (!useMeili) list = filterListingBySellers(list, sellerFilters)
    list = filterListingByPrice(list, priceMin, priceMax)
    list = filterListingByRating(list, minRating)
    return sortListingProducts(list, sort).slice(0, limit)
  }, [
    rawProducts,
    sellerFilters,
    sort,
    useMeili,
    limit,
    priceMin,
    priceMax,
    minRating,
  ])

  const count = useMeili
    ? Math.max(discoveryQ.data?.estimatedTotalHits ?? 0, products.length)
    : products.length

  const loading = discoveryQ.isLoading || (!useMeili && productsQ.isLoading)
  const error = useMeili
    ? discoveryQ.isError
    : productsQ.isError && discoveryQ.isError
  const errMsg = useMeili ? discoveryQ.error : productsQ.error
  const fetching =
    discoveryQ.isFetching || (!useMeili && productsQ.isFetching)

  const sellerOpts = useMemo(() => {
    const map = new Map<
      string,
      { handle: string; name: string; count: number }
    >()
    for (const p of rawProducts) {
      const h = p.seller?.handle?.trim()
      const n = p.seller?.name?.trim()
      if (!h || !n) continue
      const cur = map.get(h)
      if (cur) cur.count += 1
      else map.set(h, { handle: h, name: n, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [rawProducts])

  const filterState: ListingFilterState = {
    sellerHandles: sellerFilters,
    sort,
    priceMin,
    priceMax,
  }

  function applySidebarFilters(next: ListingFilterState) {
    setPriceMin(next.priceMin ?? null)
    setPriceMax(next.priceMax ?? null)
    void navigate({
      to: "/categories/$slug",
      params: { slug },
      search: {
        ...(next.sellerHandles.length
          ? { seller: next.sellerHandles }
          : {}),
        ...(next.sort !== "featured" ? { sort: next.sort } : {}),
      },
    })
  }

  const stripState: FilterStripState = {
    subCategory,
    minRating,
    priceMin,
    priceMax,
    sort,
    viewMode,
    location,
  }

  function applyStrip(next: FilterStripState) {
    setSubCategory(next.subCategory)
    setMinRating(next.minRating)
    setPriceMin(next.priceMin)
    setPriceMax(next.priceMax)
    setViewMode(next.viewMode)
    setLocation(next.location)
    // Location filters pass to Meili when engine supports them (P1+ index).
    // Until then UI stays honest via locationEnabled=false.
    if (next.sort !== sort) {
      void navigate({
        to: "/categories/$slug",
        params: { slug },
        search: {
          ...(sellerFilters.length ? { seller: sellerFilters } : {}),
          ...(next.sort !== "featured" ? { sort: next.sort } : {}),
        },
      })
    }
  }

  function toggleFilters() {
    setFiltersOpen((v) => {
      const next = !v
      try {
        sessionStorage.setItem("alkemart.plp.filtersOpen", next ? "1" : "0")
      } catch {
        /* private mode */
      }
      return next
    })
  }

  function applySort(next: ListingSort) {
    void navigate({
      to: "/categories/$slug",
      params: { slug },
      search: {
        ...(sellerFilters.length ? { seller: sellerFilters } : {}),
        ...(next !== "featured" ? { sort: next } : {}),
      },
    })
  }

  const activeFilterCount =
    sellerFilters.length +
    (priceMin != null ? 1 : 0) +
    (priceMax != null ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (subCategory !== "all" ? 1 : 0) +
    (location.province || location.city ? 1 : 0) +
    (sort !== "featured" ? 1 : 0)

  const categories = resolveRailCategories(categoriesQ.data ?? [])
  const showMissing = missingCategory && !category
  const heroSlug = isAll ? "all" : slug
  const art = listingHeroArt(heroSlug)

  return (
    <>
      <PageSeo
        title={title}
        description={
          isAll
            ? "Browse products and compare multi-seller prices on alkemart."
            : `Browse ${title} on alkemart — compare multi-seller offers.`
        }
        path={`/categories/${slug}`}
        noindex={sellerFilters.length > 0 || Boolean(search.sort)}
      />

      {showMissing ? (
        <EmptyState
          title="Category not found"
          description="Department not found."
          actionLabel="All products"
          actionTo="/categories/$slug"
          actionParams={{ slug: "all" }}
        />
      ) : (
        <ListingLayout
          title={title}
          count={count}
          loadingCount={loading && products.length === 0}
          crumbs={[
            { label: "Home", to: "/" },
            { label: title },
          ]}
          hero={
            <ListingHero
              title={listingHeroTitle(title, isAll)}
              accent={listingHeroAccent(isAll)}
              body={listingHeroBody(isAll, title)}
              imageSrc={art}
              imageAlt=""
            />
          }
          filterStrip={
            <ListingFilterStrip
              departmentLabel={isAll ? "Catalog" : title}
              subCategories={subCats}
              state={stripState}
              onChange={applyStrip}
              locationEnabled={false}
            />
          }
          filtersOpen={filtersOpen}
          onToggleFilters={toggleFilters}
          activeFilterCount={activeFilterCount}
          sort={sort}
          onSortChange={applySort}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          toolbar={
            categories.length > 0 ? (
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
                <Chip
                  to="/categories/$slug"
                  params={{ slug: "all" }}
                  active={isAll}
                >
                  All
                </Chip>
                {categories.map((c) => {
                  const s = c.handle || c.id
                  return (
                    <Chip
                      key={c.id}
                      to="/categories/$slug"
                      params={{ slug: s }}
                      active={slug === s}
                    >
                      {c.name}
                    </Chip>
                  )
                })}
              </div>
            ) : null
          }
          sidebar={
            <ListingFilters
              activeCategorySlug={isAll ? "all" : slug}
              departmentName={isAll ? "All" : title}
              categories={categories}
              subCategories={subCats}
              sellers={sellerOpts}
              state={filterState}
              onChange={applySidebarFilters}
            />
          }
        >
          {loading && products.length === 0 ? (
            <ProductGridSkeleton count={8} />
          ) : null}

          {error && products.length === 0 ? (
            <ErrorAlert
              message={errMsg instanceof Error ? errMsg.message : "Could not load products"}
            />
          ) : null}

          {!loading && products.length === 0 ? (
            <EmptyState
              title="No products"
              description="Try another department or clear filters."
              actionLabel="All products"
              actionTo="/categories/$slug"
              actionParams={{ slug: "all" }}
            />
          ) : null}

          {products.length > 0 ? (
            <>
              {viewMode === "list" ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} size="row" />
                  ))}
                </div>
              ) : (
                <ProductGridShell>
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} size="tile" />
                  ))}
                </ProductGridShell>
              )}
              <LoadMore
                shown={products.length}
                total={Math.max(count, products.length)}
                loading={fetching && !loading}
                onLoadMore={() => setLimit((n) => n + PAGE)}
                label="View more"
              />
            </>
          ) : null}
        </ListingLayout>
      )}
    </>
  )
}

function Chip(props: {
  to: "/categories/$slug"
  params: { slug: string }
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={props.to}
      params={props.params}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 type-sm font-semibold transition",
        props.active
          ? "bg-foreground text-background"
          : "border border-border bg-card hover:border-primary",
      )}
    >
      {props.children}
    </Link>
  )
}
