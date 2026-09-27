import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { FilterPanel } from "@/components/listing/filter-panel"
import { ListingShell } from "@/components/listing/listing-shell"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useCategories } from "@/hooks/use-store"
import { listStoreProducts, productParam } from "@/lib/products"
import { searchCatalog } from "@/lib/search"
import { fetchCatalogFacets } from "@/lib/catalog-facets"
import { resolveBrowseCategory, resolveSubCategories, formatSlugTitle } from "@/lib/catalog-nav"
import {
  EMPTY_FACETS,
  appliedFacets,
  filterListingByRating,
  filterListingBySellers,
  parseAttributeFacets,
  retargetFacets,
  serializeAttributeFacets,
  sortListingProducts,
  type ListingFacetState,
  type ListingSort,
} from "@/lib/listing/ListingFacets"
import { itemListJsonLd } from "@/lib/seo"
import { trackCategoryViewed, trackFilterApplied } from "@/lib/analytics"

type Search = {
  seller?: string[]
  sort?: ListingSort
  sub?: string
  rating?: number
  min?: number
  max?: number
  attrs?: string
}

const list = (v: unknown): string[] =>
  typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const Route = createFileRoute("/categories/$slug")({
  // The URL is the single source of truth for facets: shareable, back-safe.
  validateSearch: (s: Record<string, unknown>): Search => {
    const seller = list(s.seller)
    const sort = ["price_asc", "price_desc", "title"].includes(s.sort as string) ? (s.sort as ListingSort) : undefined
    const rating = num(s.rating)
    const attrs = serializeAttributeFacets(parseAttributeFacets(s.attrs))
    return {
      ...(seller.length ? { seller } : {}),
      ...(sort ? { sort } : {}),
      ...(typeof s.sub === "string" && s.sub ? { sub: s.sub } : {}),
      ...(rating && Number.isInteger(rating) && rating <= 5 ? { rating } : {}),
      ...(num(s.min) != null ? { min: num(s.min) } : {}),
      ...(num(s.max) != null ? { max: num(s.max) } : {}),
      ...(attrs ? { attrs } : {}),
    }
  },
  component: CategoryPage,
})

const PAGE = 24

function toSearch(f: ListingFacetState): Search {
  const attrs = serializeAttributeFacets(f.attributes)
  return {
    ...(f.sellerHandles.length ? { seller: f.sellerHandles } : {}),
    ...(f.sort !== "featured" ? { sort: f.sort } : {}),
    ...(f.subCategory !== "all" ? { sub: f.subCategory } : {}),
    ...(f.minRating > 0 ? { rating: f.minRating } : {}),
    ...(f.priceMin != null ? { min: f.priceMin } : {}),
    ...(f.priceMax != null ? { max: f.priceMax } : {}),
    ...(attrs ? { attrs } : {}),
  }
}

function CategoryPage() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const isAll = slug === "all"
  const searchKey = `${slug}|${JSON.stringify(search)}`
  const [paging, setPaging] = useState({ key: searchKey, limit: PAGE })
  const limit = paging.key === searchKey ? paging.limit : PAGE
  const setLimit = (f: (n: number) => number) => setPaging({ key: searchKey, limit: f(limit) })

  const facets: ListingFacetState = useMemo(
    () => ({
      ...EMPTY_FACETS,
      sellerHandles: search.seller ?? [],
      sort: search.sort ?? "featured",
      subCategory: search.sub ?? "all",
      minRating: search.rating ?? 0,
      priceMin: search.min ?? null,
      priceMax: search.max ?? null,
      attributes: parseAttributeFacets(search.attrs),
    }),
    [search],
  )
  const apply = useCallback(
    (next: ListingFacetState) => {
      for (const a of appliedFacets(next)) {
        if (!appliedFacets(facets).some((b) => b.key === a.key)) trackFilterApplied({ dimension: a.group, value: a.label })
      }
      void navigate({ to: "/categories/$slug", params: { slug }, search: toSearch(next), replace: true })
    },
    [navigate, slug, facets],
  )

  const categoriesQ = useCategories()
  const all = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])
  const category = isAll ? null : resolveBrowseCategory(all, slug)
  const subCats = useMemo(() => resolveSubCategories(category, all), [category, all])
  const sub = subCats.find((c) => c.id === facets.subCategory)
  const handle = sub ? (sub.handle ?? sub.id) : isAll ? undefined : (category?.handle ?? slug)
  const title = isAll ? "All products" : (category?.name ?? formatSlugTitle(slug))
  const parent = category?.parentCategoryId ? all.find((c) => c.id === category.parentCategoryId) : undefined

  const categoryId = category?.id
  const categoryHandle = category?.handle
  useEffect(() => {
    if (categoryId) trackCategoryViewed({ categoryId, slug: categoryHandle })
  }, [categoryId, categoryHandle])

  // Price and attributes filter on the server (/store/search) so results
  // cover the whole catalogue, not just the first page.
  const serverFiltered = facets.priceMin != null || facets.priceMax != null || Object.keys(facets.attributes).length > 0
  const serverSort = facets.sort === "price_asc" || facets.sort === "price_desc" ? facets.sort : undefined

  const catalogQ = useQuery({
    queryKey: ["store", "listing", handle ?? "all", serverSort, limit],
    queryFn: () => listStoreProducts({ limit, categoryHandle: handle, sort: serverSort }),
    enabled: !serverFiltered,
    placeholderData: (prev) => prev,
  })
  const filteredQ = useQuery({
    queryKey: ["store", "listing-search", handle ?? "all", facets.priceMin, facets.priceMax, search.attrs, limit],
    queryFn: () =>
      searchCatalog({
        q: "",
        limit,
        filters: {
          ...(handle ? { category_handles: [handle] } : {}),
          ...(facets.priceMin != null ? { min_price: facets.priceMin } : {}),
          ...(facets.priceMax != null ? { max_price: facets.priceMax } : {}),
          attributes: facets.attributes,
        },
      }),
    enabled: serverFiltered,
    placeholderData: (prev) => prev,
  })
  const active = serverFiltered ? filteredQ : catalogQ
  const raw = useMemo(
    () => (serverFiltered ? filteredQ.data?.products : catalogQ.data?.products) ?? [],
    [serverFiltered, filteredQ.data, catalogQ.data],
  )
  const serverTotal = serverFiltered ? (filteredQ.data?.estimatedTotalHits ?? 0) : (catalogQ.data?.count ?? 0)

  const facetsQ = useQuery({
    queryKey: ["store", "catalog-facets", handle ?? "all"],
    queryFn: ({ signal }) => fetchCatalogFacets(handle ?? "all", signal),
    staleTime: 300_000,
  })
  // Attribute filters carried in from another category are pruned once this
  // category's facet list is known — never before.
  useEffect(() => {
    if (!facetsQ.data) return
    const { state, dropped } = retargetFacets(facets, facetsQ.data.attributes.map((a) => a.code))
    if (!dropped.length) return
    toast(`${dropped.map((d) => d.code).join(", ")} doesn't apply in this category — removed.`)
    apply(state)
  }, [facetsQ.data, facets, apply])

  // Seller + rating have no server filter yet: applied to the loaded results.
  const clientFiltered = facets.sellerHandles.length > 0 || facets.minRating > 0
  const products = useMemo(() => {
    const narrowed = filterListingByRating(filterListingBySellers(raw, facets.sellerHandles), facets.minRating)
    return facets.sort === "title" || serverFiltered ? sortListingProducts(narrowed, facets.sort) : narrowed
  }, [raw, facets, serverFiltered])

  const sellers = useMemo(() => {
    const m = new Map<string, { handle: string; name: string; count: number }>()
    for (const p of raw) {
      const h = p.seller?.handle
      if (!h || !p.seller?.name) continue
      const cur = m.get(h) ?? { handle: h, name: p.seller.name, count: 0 }
      cur.count++
      m.set(h, cur)
    }
    for (const h of facets.sellerHandles) if (!m.has(h)) m.set(h, { handle: h, name: h, count: 0 })
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [raw, facets.sellerHandles])

  const applied = appliedFacets(facets, {
    sellerName: (h) => sellers.find((s) => s.handle === h)?.name ?? h,
    subCategoryLabel: (id) => subCats.find((c) => c.id === id)?.label ?? id,
    attributeLabel: (code) => facetsQ.data?.attributes.find((a) => a.code === code)?.label ?? code,
  })

  const countLabel = active.isLoading
    ? null
    : clientFiltered
      ? `${products.length} match${products.length === 1 ? "" : "es"} in the first ${raw.length} of ${serverTotal.toLocaleString()} products`
      : `${serverTotal.toLocaleString()} product${serverTotal === 1 ? "" : "s"}`

  if (!isAll && categoriesQ.isSuccess && !category) {
    return (
      <div className="container-page py-10">
        <PageSeo title="Category not found" noindex />
        <EmptyState
          title="We couldn't find that category"
          description="It may have been renamed. Browse all departments instead."
          action={{ label: "All categories", to: "/categories" }}
        />
      </div>
    )
  }

  return (
    <>
      <PageSeo
        title={sub ? `${title} — ${sub.label}` : title}
        description={`Shop ${title} from trusted sellers on alkemart.`}
        path={`/categories/${slug}`}
        noindex={applied.length > 0}
        jsonLd={itemListJsonLd({
          name: title,
          path: `/categories/${slug}`,
          items: products.slice(0, 30).map((p) => ({ name: p.title, path: `/product/${productParam(p)}` })),
        })}
      />
      <ListingShell
        header={
          <div className="mb-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/categories">Categories</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {parent ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/categories/$slug" params={{ slug: parent.handle ?? parent.id }}>
                          {parent.name}
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </>
                ) : null}
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        }
        belowTitle={subCats.length > 0 ? (
              <div className="rail lg:hidden">
                {[{ id: "all", label: "All" }, ...subCats].map((c) => (
                  <Button
                    key={c.id}
                    variant={facets.subCategory === c.id ? "default" : "secondary"}
                    size="sm"
                    onClick={() => apply({ ...facets, subCategory: c.id })}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            ) : null}
        title={sub ? sub.label : title}
        countLabel={countLabel}
        sort={facets.sort}
        sortOptions={[
          { value: "featured", label: "Newest" },
          { value: "price_asc", label: "Price: low to high" },
          { value: "price_desc", label: "Price: high to low" },
          { value: "title", label: "Name A–Z" },
        ]}
        onSort={(sort) => apply({ ...facets, sort })}
        filters={
          <FilterPanel
            state={facets}
            onChange={apply}
            slug={slug}
            subCategories={subCats}
            sellers={sellers}
            attributes={facetsQ.data?.attributes ?? []}
            resultCount={raw.length}
          />
        }
        applied={applied}
        onRemoveFacet={(a) => apply(a.clear(facets))}
        onClearAll={() => apply({ ...EMPTY_FACETS, sort: facets.sort })}
        products={products}
        loading={active.isLoading}
        switching={active.isPlaceholderData && active.isFetching}
        hasMore={raw.length >= limit && raw.length < serverTotal}
        loadingMore={active.isFetching && !active.isLoading}
        onLoadMore={() => setLimit((n) => n + PAGE)}
        empty={
          active.isError ? (
            <ErrorState title="Products didn't load" error={active.error} onRetry={() => void active.refetch()} />
          ) : applied.length ? (
            <EmptyState
              title="No products match these filters"
              description="Try removing a filter or two."
              illustration="no-results"
            >
              <Button variant="outline" onClick={() => apply({ ...EMPTY_FACETS })}>
                Clear filters
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              title={`Nothing in ${title} yet`}
              description="Sellers are adding products all the time. Check back soon."
              illustration="empty-shelf"
              action={{ label: "Browse all products", to: "/categories/$slug", params: { slug: "all" } }}
            />
          )
        }
      />
    </>
  )
}
