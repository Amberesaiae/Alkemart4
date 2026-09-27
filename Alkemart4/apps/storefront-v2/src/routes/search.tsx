import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Clock01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { SearchBox } from "@/components/shell/search-box"
import { CategoryPill } from "@/components/commerce/category-tile"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { FilterPanel } from "@/components/listing/filter-panel"
import { ListingShell } from "@/components/listing/listing-shell"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { CompareBar, CompareSoon, CompareToggle } from "@/components/compare/compare-mode"
import { useComparePicker } from "@/lib/compare-picker"
import { COMPARE_ENABLED } from "@/lib/features"
import { useCategories } from "@/hooks/use-store"
import { searchCatalog } from "@/lib/search"
import { fetchCatalogFacets } from "@/lib/catalog-facets"
import { useSearchHistory } from "@/lib/search-history"
import {
  EMPTY_FACETS,
  appliedFacets,
  filterListingByRating,
  filterListingBySellers,
  parseAttributeFacets,
  serializeAttributeFacets,
  sortListingProducts,
  type ListingFacetState,
  type ListingSort,
} from "@/lib/listing/ListingFacets"
import { trackSearchLandingViewed, trackSearchZeroResults } from "@/lib/analytics"

type Search = {
  q?: string
  category?: string
  seller?: string[]
  min?: number
  max?: number
  rating?: number
  sort?: ListingSort
  attrs?: string
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const seller = typeof s.seller === "string" ? s.seller.split(",").filter(Boolean) : Array.isArray(s.seller) ? (s.seller as string[]) : []
    const attrs = serializeAttributeFacets(parseAttributeFacets(s.attrs))
    const sort = ["price_asc", "price_desc", "title"].includes(s.sort as string) ? (s.sort as ListingSort) : undefined
    const rating = num(s.rating)
    return {
      ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.trim() } : {}),
      ...(typeof s.category === "string" && s.category ? { category: s.category } : {}),
      ...(seller.length ? { seller } : {}),
      ...(num(s.min) != null ? { min: num(s.min) } : {}),
      ...(num(s.max) != null ? { max: num(s.max) } : {}),
      ...(rating && rating <= 5 ? { rating } : {}),
      ...(sort ? { sort } : {}),
      ...(attrs ? { attrs } : {}),
    }
  },
  component: SearchPage,
})

const PAGE = 48

function SearchPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const q = search.q ?? ""
  // Paging resets whenever the query/filters change (derived, not an effect).
  const searchKey = JSON.stringify(search)
  const [paging, setPaging] = useState({ key: searchKey, limit: PAGE })
  const limit = paging.key === searchKey ? paging.limit : PAGE
  const setLimit = (f: (n: number) => number) => setPaging({ key: searchKey, limit: f(limit) })
  const compare = useComparePicker()

  const facets: ListingFacetState = useMemo(
    () => ({
      ...EMPTY_FACETS,
      subCategory: search.category ?? "all",
      sellerHandles: search.seller ?? [],
      priceMin: search.min ?? null,
      priceMax: search.max ?? null,
      minRating: search.rating ?? 0,
      sort: search.sort ?? "featured",
      attributes: parseAttributeFacets(search.attrs),
    }),
    [search],
  )
  const apply = (f: ListingFacetState) => {
    const attrs = serializeAttributeFacets(f.attributes)
    void navigate({
      to: "/search",
      replace: true,
      search: {
        ...(q ? { q } : {}),
        ...(f.subCategory !== "all" ? { category: f.subCategory } : {}),
        ...(f.sellerHandles.length ? { seller: f.sellerHandles } : {}),
        ...(f.priceMin != null ? { min: f.priceMin } : {}),
        ...(f.priceMax != null ? { max: f.priceMax } : {}),
        ...(f.minRating ? { rating: f.minRating } : {}),
        ...(f.sort !== "featured" ? { sort: f.sort } : {}),
        ...(attrs ? { attrs } : {}),
      },
    })
  }

  const hasQuery = Boolean(q) || Boolean(search.category) || facets.priceMin != null || facets.priceMax != null
  const { condition = [], ...attributes } = facets.attributes
  const resultsQ = useQuery({
    queryKey: ["store", "search", q, search.category, facets.priceMin, facets.priceMax, search.attrs, limit],
    queryFn: () =>
      searchCatalog({
        q,
        limit,
        filters: {
          ...(search.category ? { category_handles: [search.category] } : {}),
          ...(facets.priceMin != null ? { min_price: facets.priceMin } : {}),
          ...(facets.priceMax != null ? { max_price: facets.priceMax } : {}),
          attributes,
          conditions: condition,
        },
      }),
    enabled: hasQuery,
    placeholderData: (prev) => prev,
  })

  // Alias redirects (e.g. a brand term → its category) are the server's call.
  useEffect(() => {
    const to = resultsQ.data?.redirect
    if (to && to.startsWith("/")) void navigate({ to: to as never, replace: true })
  }, [resultsQ.data?.redirect, navigate])

  useEffect(() => {
    if (!hasQuery) trackSearchLandingViewed()
  }, [hasQuery])
  useEffect(() => {
    if (q && resultsQ.isSuccess && resultsQ.data.estimatedTotalHits === 0) trackSearchZeroResults({ query: q })
  }, [q, resultsQ.isSuccess, resultsQ.data?.estimatedTotalHits])

  const labelsQ = useQuery({
    queryKey: ["store", "catalog-facets", "all"],
    queryFn: ({ signal }) => fetchCatalogFacets("all", signal),
    staleTime: 300_000,
  })
  const categoriesQ = useCategories()
  const departments = (categoriesQ.data ?? []).filter((c) => !c.parentCategoryId)

  const raw = useMemo(() => resultsQ.data?.products ?? [], [resultsQ.data])
  const products = useMemo(
    () => sortListingProducts(filterListingByRating(filterListingBySellers(raw, facets.sellerHandles), facets.minRating), facets.sort),
    [raw, facets],
  )
  const sellers = useMemo(() => {
    const m = new Map<string, { handle: string; name: string; count: number }>()
    for (const p of raw) {
      if (!p.seller?.handle || !p.seller.name) continue
      const cur = m.get(p.seller.handle) ?? { handle: p.seller.handle, name: p.seller.name, count: 0 }
      cur.count++
      m.set(p.seller.handle, cur)
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [raw])
  const labelFor = (code: string) =>
    code === "condition" ? "Condition" : (labelsQ.data?.attributes.find((a) => a.code === code)?.label ?? code.replace(/_/g, " "))
  const attributeGroups = Object.entries(resultsQ.data?.facetDistribution ?? {}).map(([code, values]) => ({
    code,
    label: labelFor(code),
    values,
  }))
  const applied = appliedFacets(facets, {
    sellerName: (h) => sellers.find((s) => s.handle === h)?.name ?? h,
    subCategoryLabel: (h) => departments.find((d) => (d.handle ?? d.id) === h)?.name ?? h,
    attributeLabel: labelFor,
  })
  const total = resultsQ.data?.estimatedTotalHits ?? 0
  const clientFiltered = facets.sellerHandles.length > 0 || facets.minRating > 0

  if (!hasQuery) return <SearchLanding />

  return (
    <>
      <PageSeo title={q ? `Search: ${q}` : "Search"} path="/search" noindex />
      <ListingShell
        header={<SearchBox key={q} initialQuery={q} className="mb-6 max-w-2xl md:hidden" />}
        title={q ? `Results for “${q}”` : "Search results"}
        belowTitle={
          !COMPARE_ENABLED ? (
            <CompareSoon />
          ) : (
          <div className="flex flex-wrap items-center gap-3">
            <CompareToggle on={compare.on} onChange={compare.setOn} />
            {compare.on ? <p className="text-sm text-muted-foreground">Pick 2 to 4 products to see them side by side.</p> : null}
          </div>
          )
        }
        pick={COMPARE_ENABLED ? compare.pick : undefined}
        countLabel={
          resultsQ.isLoading
            ? null
            : clientFiltered
              ? `${products.length} of ${total.toLocaleString()} results match your filters`
              : `${total.toLocaleString()} result${total === 1 ? "" : "s"}${resultsQ.data?.appliedAlias ? ` · including “${resultsQ.data.appliedAlias.term}”` : ""}`
        }
        sort={facets.sort}
        sortOptions={[
          { value: "featured", label: "Best match" },
          { value: "price_asc", label: "Price: low to high" },
          { value: "price_desc", label: "Price: high to low" },
          { value: "title", label: "Name A–Z" },
        ]}
        onSort={(sort) => apply({ ...facets, sort })}
        filters={
          <FilterPanel
            state={facets}
            onChange={apply}
            slug="all"
            subCategories={departments.map((d) => ({ id: d.handle ?? d.id, label: d.name, handle: d.handle ?? null }))}
            sellers={sellers}
            attributes={attributeGroups}
            resultCount={total}
          />
        }
        applied={applied}
        onRemoveFacet={(a) => apply(a.clear(facets))}
        onClearAll={() => apply({ ...EMPTY_FACETS })}
        products={products}
        loading={resultsQ.isLoading}
        switching={resultsQ.isPlaceholderData && resultsQ.isFetching}
        hasMore={raw.length >= limit && raw.length < total}
        loadingMore={resultsQ.isFetching && !resultsQ.isLoading}
        onLoadMore={() => setLimit((n) => n + PAGE)}
        empty={
          resultsQ.isError ? (
            <ErrorState title="Search is unavailable right now" error={resultsQ.error} onRetry={() => void resultsQ.refetch()} />
          ) : (
            <EmptyState
              title={q ? `No results for “${q}”` : "No matching products"}
              description={applied.length ? "Try removing a filter." : "Check the spelling or try a broader word."}
              illustration="no-results"
            >
              <ZeroResultHelp suggestions={resultsQ.data?.suggestions} />
            </EmptyState>
          )
        }
      />
      {COMPARE_ENABLED && compare.on ? <CompareBar selected={compare.selected} onClear={compare.clear} /> : null}
    </>
  )
}

/** Recovery on zero results: server-suggested categories and shops only. */
function ZeroResultHelp({ suggestions }: { suggestions?: { categories: { id: string; name: string; slug: string }[]; shops: { handle: string; name: string }[] } }) {
  if (!suggestions || (!suggestions.categories.length && !suggestions.shops.length)) return null
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.categories.map((c) => (
        <Button key={c.id} asChild variant="secondary" size="sm">
          <Link to="/categories/$slug" params={{ slug: c.slug }}>
            {c.name}
          </Link>
        </Button>
      ))}
      {suggestions.shops.map((s) => (
        <Button key={s.handle} asChild variant="secondary" size="sm">
          <Link to="/shops/$slug" params={{ slug: s.handle }}>
            <SellerAvatar name={s.name} size="sm" /> {s.name}
          </Link>
        </Button>
      ))}
    </div>
  )
}

function SearchLanding() {
  const { recent, removeQuery, clearAll } = useSearchHistory()
  const categoriesQ = useCategories()
  const departments = (categoriesQ.data ?? []).filter((c) => !c.parentCategoryId).slice(0, 12)
  return (
    <div className="container-page max-w-3xl space-y-10 py-8">
      <PageSeo title="Search" path="/search" />
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold">What are you looking for?</h1>
        <SearchBox autoFocus />
      </div>
      {recent.length ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent searches</h2>
            <button type="button" onClick={clearAll} className="text-sm text-muted-foreground hover:underline">
              Clear
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((t) => (
              <li key={t} className="flex items-center rounded-full bg-surface">
                <Link to="/search" search={{ q: t }} className="flex items-center gap-1.5 py-2 pl-3 text-sm">
                  <HugeiconsIcon icon={Clock01Icon} className="size-4 text-muted-foreground" /> {t}
                </Link>
                <button type="button" onClick={() => removeQuery(t)} aria-label={`Remove ${t}`} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {departments.length ? (
        <section>
          <h2 className="mb-3 font-semibold">Browse departments</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((c) => (
              <CategoryPill key={c.id} handle={c.handle ?? c.id} name={c.name} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
