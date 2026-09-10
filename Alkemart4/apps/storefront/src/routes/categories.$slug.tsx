import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ErrorAlert } from "@/components/error-alert"
import { LoadMore } from "@/components/load-more"
import { ProductGridSkeleton } from "@/components/skeleton"
import {
  ListingAppliedFacets,
  ListingFilters,
  ListingFilterStrip,
  ListingHero,
  ListingLayout,
  appliedFacets,
  filterListingByPrice,
  filterListingByRating,
  filterListingBySellers,
  listingHeroArt,
  listingHeroTitle,
  listingHeroAccent,
  listingHeroBody,
  resetFacets,
  sortListingProducts,
  type ListingFacetState,
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
import { deptThemeClass } from "@/lib/category-theme"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/categories/$slug")({
  /**
   * Every facet lives here — the URL is the single source of truth, so a
   * filtered listing is shareable and survives back/forward. Defaults are
   * omitted from the querystring to keep canonical URLs clean.
   */
  validateSearch: (search: Record<string, unknown>) => {
    const seller = parseList(search.seller)
    const sort = parseSort(search.sort)
    const sub = parseSlug(search.sub)
    const rating = parseRating(search.rating)
    const min = parseAmount(search.min)
    const max = parseAmount(search.max)
    const region = parseSlug(search.region)
    const city = parseSlug(search.city)
    return {
      ...(seller.length ? { seller } : {}),
      ...(sort && sort !== "featured" ? { sort } : {}),
      ...(sub ? { sub } : {}),
      ...(rating ? { rating } : {}),
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
      ...(region ? { region } : {}),
      ...(city ? { city } : {}),
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

function parseSlug(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

function parseRating(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined
}

function parseAmount(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
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
  /** View mode is a presentation preference, not a facet — stays local. */
  const [viewMode, setViewMode] = useState<ListingViewMode>("grid")

  /** The one facet state. Sidebar and strip both read and write this. */
  const facets: ListingFacetState = useMemo(
    () => ({
      sellerHandles: search.seller ?? [],
      sort: search.sort ?? "featured",
      priceMin: search.min ?? null,
      priceMax: search.max ?? null,
      minRating: search.rating ?? 0,
      subCategory: search.sub ?? "all",
      location: {
        province: search.region ?? null,
        city: search.city ?? null,
      },
    }),
    [search],
  )

  const sellerFilters = facets.sellerHandles
  const sort = facets.sort

  const applyFacets = useCallback(
    (next: ListingFacetState) => {
      void navigate({
        to: "/categories/$slug",
        params: { slug },
        search: {
          ...(next.sellerHandles.length ? { seller: next.sellerHandles } : {}),
          ...(next.sort !== "featured" ? { sort: next.sort } : {}),
          ...(next.subCategory !== "all" ? { sub: next.subCategory } : {}),
          ...(next.minRating > 0 ? { rating: next.minRating } : {}),
          ...(next.priceMin != null ? { min: next.priceMin } : {}),
          ...(next.priceMax != null ? { max: next.priceMax } : {}),
          ...(next.location.province ? { region: next.location.province } : {}),
          ...(next.location.city ? { city: next.location.city } : {}),
        },
      })
    },
    [navigate, slug],
  )

  const clearAllFacets = useCallback(
    () => applyFacets(resetFacets()),
    [applyFacets],
  )

  // Paging resets whenever the result set changes identity.
  useEffect(() => {
    setLimit(PAGE)
  }, [slug, search])

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
  const selectedSub = subCats.find((c) => c.id === facets.subCategory)
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

  /** Everything except rating — the base the rating counts are computed from. */
  const beforeRating = useMemo(() => {
    let list = rawProducts
    if (!useMeili) list = filterListingBySellers(list, facets.sellerHandles)
    return filterListingByPrice(list, facets.priceMin, facets.priceMax)
  }, [rawProducts, useMeili, facets.sellerHandles, facets.priceMin, facets.priceMax])

  /** Live per-bucket counts so the rating facet can hide dead ends. */
  const ratingCounts = useMemo(() => {
    const out: Record<number, number> = {}
    for (const n of [1, 2, 3, 4, 5]) {
      out[n] = filterListingByRating(beforeRating, n).length
    }
    return out
  }, [beforeRating])

  const products = useMemo(
    () =>
      sortListingProducts(
        filterListingByRating(beforeRating, facets.minRating),
        facets.sort,
      ).slice(0, limit),
    [beforeRating, facets.minRating, facets.sort, limit],
  )

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
    applyFacets({ ...facets, sort: next })
  }

  /**
   * Chips and the Filters badge read the same list, so the count can never
   * disagree with what the shopper can actually see and remove.
   */
  const applied = useMemo(
    () =>
      appliedFacets(facets, {
        sellerName: (handle) =>
          sellerOpts.find((o) => o.handle === handle)?.name ?? handle,
        subCategoryLabel: (id) =>
          subCats.find((c) => c.id === id)?.label ?? id,
      }),
    [facets, sellerOpts, subCats],
  )
  const activeFilterCount = applied.length

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
              className={deptThemeClass(isAll ? "All" : title, isAll ? null : slug)}
              ratingCounts={ratingCounts}
              state={facets}
              onChange={applyFacets}
              locationEnabled={false}
            />
          }
          filtersOpen={filtersOpen}
          onToggleFilters={toggleFilters}
          activeFilterCount={activeFilterCount}
          applied={
            <ListingAppliedFacets
              facets={applied}
              state={facets}
              onChange={applyFacets}
              onClearAll={clearAllFacets}
              count={count}
              loadingCount={loading && products.length === 0}
            />
          }
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
              state={facets}
              onChange={applyFacets}
              onClearAll={activeFilterCount > 0 ? clearAllFacets : undefined}
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
