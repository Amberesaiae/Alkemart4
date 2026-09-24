import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { ErrorAlert } from "@/components/error-alert"
import { LoadMore } from "@/components/load-more"
import { ProductGridSkeleton } from "@/components/skeleton"
import {
  CategoryVisualRail,
  ListingAppliedFacets,
  ListingFilterDropdown,
  ListingAttributeFacets,
  ListingFilters,
  ListingLayout,
  ListingPagination,
  ListingQuickFilters,
  appliedFacets,
  filterListingByPrice,
  filterListingByRating,
  filterListingBySellers,
  resetFacets,
  resolveCategoryImage,
  parseAttributeFacets,
  serializeAttributeFacets,
  toggleAttributeFacet,
  sortListingProducts,
  type ListingFacetState,
  type ListingSort,
} from "@/components/listing"
import { HomeRecentlyViewed } from "@/components/home/HomeRecentlyViewed"
import { PageSeo } from "@/components/page-seo"
import { itemListJsonLd } from "@/lib/seo"
import { listStoreCategories, listStoreProducts, listStoreSellers } from "@/lib/products"
import { searchCatalog } from "@/lib/search"
import { useCloudflareCatalog } from "@/lib/env"
import {
  resolveBrowseCategory,
  RAIL_DEPARTMENT_ORDER,
  CANONICAL_NAMES,
  formatSlugTitle,
  resolveSubCategories,
} from "@/lib/catalog-nav"
import { deptThemeClass } from "@/lib/category-theme"

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
    // Round-trip through the codec so a hand-edited URL cannot inject a
    // malformed filter string into the API query.
    const attrs = serializeAttributeFacets(parseAttributeFacets(search.attrs))
    return {
      ...(seller.length ? { seller } : {}),
      ...(sort && sort !== "featured" ? { sort } : {}),
      ...(sub ? { sub } : {}),
      ...(rating ? { rating } : {}),
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
      ...(region ? { region } : {}),
      ...(city ? { city } : {}),
      ...(attrs ? { attrs } : {}),
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
 * PLP — foundational composition (MOWAFER reference).
 * No hero image card, no category rail, no big filter bar.
 * Left sidebar (Category + Sub-category + Sellers) on desktop;
 * compact Filters dropdown on mobile. One URL-owned facet state.
 * Modules only: ListingLayout · ListingFilters · ListingFilterDropdown · ProductCard.
 * No inline CSS.
 */
function BrowsePage() {
  const navigate = useNavigate()
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const isAll = slug === "all" || slug === ""
  const [limit, setLimit] = useState(PAGE)

  /** The one facet state. Sidebar and dropdown both read and write this. */
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
      attributes: parseAttributeFacets(search.attrs),
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
          ...(serializeAttributeFacets(next.attributes)
            ? { attrs: serializeAttributeFacets(next.attributes) }
            : {}),
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
    () => resolveSubCategories(category ?? null, categoriesQ.data ?? [], slug),
    [category, categoriesQ.data, slug],
  )

  // Sub-category selects a real child category — refetch the catalog with its
  // exact id/handle (never a client-side text match on invented labels).
  const selectedSub = subCats.find((c) => c.id === facets.subCategory)
  const effectiveCategoryId = selectedSub ? selectedSub.id : categoryId
  const effectiveCategoryHandle = selectedSub
    ? selectedSub.handle ?? selectedSub.id
    : (!isAll ? (categoryHandle ?? slug) : undefined)

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
        ...(cfCatalog
          ? {
              categoryHandle: isAll ? undefined : effectiveCategoryHandle,
            }
          : {
              categoryId: isAll ? undefined : effectiveCategoryId,
            }),
      }),
    enabled: true,
    // Keep the previous category's grid on screen while the next one loads.
    // Collapsing to a skeleton changes the page height mid-click, which is the
    // other half of the "it jumps" complaint: the buyer's cursor ends up over
    // a different row than the one they aimed at.
    placeholderData: (previous) => previous,
  })

  // Attribute facets are resolved by the API (typed values + server counts),
  // so when any are active the grid must come from /store/search rather than
  // the plain catalogue list — filtering them in the browser would disagree
  // with the counts shown beside each checkbox.
  const attrFilterKey = serializeAttributeFacets(facets.attributes)
  const facetSearchQ = useQuery({
    queryKey: ["store", "search", "facets", slug, attrFilterKey, limit],
    enabled: Boolean(attrFilterKey),
    placeholderData: (previous) => previous,
    queryFn: () =>
      searchCatalog({
        q: "",
        limit: Math.max(limit, 48),
        filters: {
          ...(isAll ? {} : { category_handles: [slug] }),
          attributes: facets.attributes,
        },
      }),
  })

  const sellersQ = useQuery({
    queryKey: ["store", "sellers"],
    queryFn: () => listStoreSellers(),
  })

  const poolQ = useQuery({
    queryKey: ["store", "products", "pool"],
    queryFn: () => listStoreProducts({ limit: 12 }),
    enabled: true,
  })

  const title = isAll
    ? "All products"
    : category?.name ?? CANONICAL_NAMES[slug.toLowerCase()] ?? formatSlugTitle(slug)

  const themeClass = isAll
    ? "theme-dept-default"
    : deptThemeClass(category?.name ?? title, categoryHandle ?? slug)

  const missingCategory = !isAll && categoriesQ.isSuccess && !category

  // When attribute facets are active the API owns the result set.
  const rawProducts = attrFilterKey
    ? facetSearchQ.data?.products ?? []
    : productsQ.data?.products ?? []

  /** Everything except rating — the base the grid is computed from. */
  const beforeRating = useMemo(() => {
    let list = filterListingBySellers(rawProducts, facets.sellerHandles)
    return filterListingByPrice(list, facets.priceMin, facets.priceMax)
  }, [rawProducts, facets.sellerHandles, facets.priceMin, facets.priceMax])

  const products = useMemo(
    () =>
      sortListingProducts(
        filterListingByRating(beforeRating, facets.minRating),
        facets.sort,
      ).slice(0, limit),
    [beforeRating, facets.minRating, facets.sort, limit],
  )

  const count = attrFilterKey
    ? facetSearchQ.data?.estimatedTotalHits ?? products.length
    : productsQ.data?.count ?? products.length

  const activeQ = attrFilterKey ? facetSearchQ : productsQ
  const loading = activeQ.isLoading
  const error = activeQ.isError
  const errMsg = activeQ.error
  const fetching = activeQ.isFetching
  // True while the previous category's results are still on screen and the new
  // ones are in flight. The grid stays put (no height collapse) but must say
  // so, or it is quietly showing the wrong category's products.
  const switching = activeQ.isPlaceholderData && fetching

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
    if (map.size > 0) {
      return [...map.values()].sort((a, b) => b.count - a.count)
    }
    const storeSellers = sellersQ.data ?? []
    if (storeSellers.length > 0) {
      return storeSellers.map((s) => ({ handle: s.handle, name: s.name, count: 0 }))
    }
    return [
      { handle: "hurry-ventures", name: "Hurry Ventures", count: 0 },
      { handle: "seller-b", name: "Kumasi Tech", count: 0 },
      { handle: "audit-vendor", name: "Audit Vendor", count: 0 },
      { handle: "qa-test-shop", name: "QA Test Shop", count: 0 },
    ]
  }, [rawProducts, sellersQ.data])

  const pool = useMemo(() => {
    if (products.length > 0) return products
    return poolQ.data?.products ?? []
  }, [products, poolQ.data])

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

  /**
   * Sidebar departments — full top-level taxonomy from the API, rank-ordered.
   * Deliberately NOT the 6-chip header rail (capped + excluded depts);
   * the sidebar is the complete wayfinding surface like the reference.
   */
  const sidebarCategories = useMemo(() => {
    const list = (categoriesQ.data ?? []).filter(
      (c) => c.id && c.name && (c.parentCategoryId == null || c.parentCategoryId === ""),
    )
    if (list.length === 0) {
      return Object.entries(CANONICAL_NAMES).map(([handle, name]) => ({
        id: handle,
        name,
        handle,
      }))
    }
    return [...list]
      .sort((a, b) => {
        const hA = (a.handle || a.id).toLowerCase()
        const hB = (b.handle || b.id).toLowerCase()
        const idxA = RAIL_DEPARTMENT_ORDER.indexOf(hA)
        const idxB = RAIL_DEPARTMENT_ORDER.indexOf(hB)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return (a.rank ?? 0) - (b.rank ?? 0)
      })
      .map((c) => ({ id: c.id, name: c.name, handle: c.handle ?? null }))
  }, [categoriesQ.data])

  const visualRailItems = useMemo(() => {
    if (!isAll) {
      if (subCats.length === 0) return []
      return subCats.map((sub) => {
        const isActive = facets.subCategory === sub.id
        return {
          id: sub.id,
          label: sub.label,
          slug,
          search: { ...search, sub: isActive ? undefined : sub.id },
          active: isActive,
          image: resolveCategoryImage(sub.handle || sub.id),
        }
      })
    }

    return sidebarCategories.map((c) => ({
      id: c.id,
      label: c.name,
      slug: c.handle || c.id,
      active: (c.handle || c.id) === slug,
      image: resolveCategoryImage(c.handle || c.id),
    }))
  }, [isAll, subCats, sidebarCategories, slug, facets.subCategory, search])

  const showMissing = missingCategory && !category
  const totalPages = Math.ceil(Math.max(count, products.length) / PAGE)
  const currentPage = Math.min(totalPages, Math.max(1, Math.ceil(limit / PAGE)))

  const crumbs = useMemo(() => {
    if (isAll) {
      return [
        { label: "Home", to: "/" },
        { label: "All products" },
      ]
    }

    if (selectedSub) {
      return [
        { label: "Home", to: "/" },
        { label: title, to: "/categories/$slug", params: { slug } },
        { label: selectedSub.label },
      ]
    }

    return [
      { label: "Home", to: "/" },
      { label: title },
    ]
  }, [isAll, title, slug, selectedSub])

  return (
    <>
      <PageSeo
        title={selectedSub ? `${title} — ${selectedSub.label}` : title}
        description={
          isAll
            ? "Browse products and compare multi-seller prices on alkemart."
            : `Browse ${title} on alkemart — compare multi-seller offers.`
        }
        path={`/categories/${slug}`}
        noindex={sellerFilters.length > 0 || Boolean(search.sort)}
        jsonLd={itemListJsonLd({
          name: title,
          path: `/categories/${slug}`,
          items: products.slice(0, 50).map((p) => ({
            name: p.title,
            path: `/product/${p.id}`,
          })),
        })}
      />

      {showMissing ? (
        <EmptyState
          title="Category not found"
          description={`"${slug}" does not match an active category.`}
          actionLabel="All products"
          actionTo="/categories/$slug"
          actionParams={{ slug: "all" }}
        />
      ) : (
        <ListingLayout
          themeClass={themeClass}
          title={selectedSub ? `${title} — ${selectedSub.label}` : title}
          count={count}
          loadingCount={loading && products.length === 0}
          crumbs={crumbs}
          categoryRail={
            visualRailItems.length > 0 ? (
              <CategoryVisualRail
                items={visualRailItems}
                title={subCats.length > 0 ? `${title} Categories` : "Categories"}
              />
            ) : null
          }
          filterDropdown={
            <ListingFilterDropdown
              departmentLabel={isAll ? "Catalog" : title}
              subCategories={subCats}
              sellers={sellerOpts}
              state={facets}
              onChange={applyFacets}
              onClearAll={clearAllFacets}
              activeCount={activeFilterCount}
            />
          }
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
          sidebar={
            <>
              <ListingFilters
                activeCategorySlug={isAll ? "all" : slug}
                departmentName={isAll ? "All" : title}
                categories={sidebarCategories}
                subCategories={subCats}
                sellers={sellerOpts}
                state={facets}
                onChange={applyFacets}
                onClearAll={activeFilterCount > 0 ? clearAllFacets : undefined}
              />
              {/* Server-counted, definition-backed. Renders nothing until a
                  category has published attribute definitions. */}
              <ListingAttributeFacets
                categorySlug={isAll ? "all" : slug}
                state={facets}
                onChange={applyFacets}
                className="mt-4"
              />
            </>
          }
          recentlyViewed={
            pool.length > 0 ? (
              <HomeRecentlyViewed products={pool} inCard />
            ) : null
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
              <div
                aria-busy={switching}
                className={cn(
                  "transition-opacity motion-reduce:transition-none",
                  switching ? "opacity-60" : "opacity-100",
                )}
              >
                <ProductGridShell>
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} size="tile" />
                  ))}
                </ProductGridShell>
              </div>
              <ListingPagination
                currentPage={currentPage}
                totalPages={totalPages}
                shownCount={products.length}
                totalCount={Math.max(count, products.length)}
                onPageChange={(page) => setLimit(page * PAGE)}
              />
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
