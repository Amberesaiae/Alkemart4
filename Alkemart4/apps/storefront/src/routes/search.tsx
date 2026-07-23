import { useEffect, useMemo, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton } from "@/components/skeleton"
import { Button } from "@/components/ui/button"
import {
  SearchFacets,
  type ActiveFilters,
} from "@/components/search-facets"
import { searchCatalog } from "@/lib/search"
import {
  trackSearchLandingViewed,
  trackSearchPerformed,
  track,
} from "@/lib/analytics"
import { PageSeo } from "@/components/page-seo"
import { IconSafe } from "@/design/icons"
import { useSearchHistory } from "@/lib/search-history"

function parseList(v: unknown): string[] {
  if (typeof v === "string" && v.trim()) {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
  }
  return []
}

export type SearchRouteSearch = {
  q?: string
  category?: string[]
  seller?: string[]
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteSearch => {
    const q = typeof search.q === "string" ? search.q : ""
    const category = parseList(search.category)
    const seller = parseList(search.seller)
    return {
      q: q || undefined,
      ...(category.length ? { category } : {}),
      ...(seller.length ? { seller } : {}),
    }
  },
  component: SearchPage,
})

function SearchPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const qParam = search.q ?? ""
  const category = search.category ?? []
  const seller = search.seller ?? []
  const [draft, setDraft] = useState(qParam)
  const { recent, frequent, trackSearch, removeQuery } = useSearchHistory()

  useEffect(() => {
    setDraft(qParam)
  }, [qParam])

  const q = qParam.trim()
  const active: ActiveFilters = useMemo(
    () => ({
      category_handles: category,
      seller_handles: seller,
    }),
    [category, seller],
  )

  const hasQueryOrFilters =
    q.length > 0 ||
    active.category_handles.length > 0 ||
    active.seller_handles.length > 0

  const productsQ = useQuery({
    queryKey: [
      "store",
      "search",
      q,
      active.category_handles.join(","),
      active.seller_handles.join(","),
    ],
    queryFn: () =>
      searchCatalog({
        q,
        limit: 48,
        filters: {
          category_handles: active.category_handles,
          seller_handles: active.seller_handles,
        },
      }),
    enabled: hasQueryOrFilters,
  })

  useEffect(() => {
    if (!q || !productsQ.isSuccess) return
    trackSearchPerformed(q, productsQ.data.estimatedTotalHits)
  }, [q, productsQ.isSuccess, productsQ.data?.estimatedTotalHits])

  useEffect(() => {
    if (hasQueryOrFilters) return
    trackSearchLandingViewed()
  }, [hasQueryOrFilters])

  function setSearch(next: {
    q?: string
    category?: string[]
    seller?: string[]
  }) {
    const nextQ = next.q ?? qParam
    const nextCat = next.category ?? category
    const nextSeller = next.seller ?? seller
    void navigate({
      to: "/search",
      search: {
        ...(nextQ ? { q: nextQ } : {}),
        ...(nextCat.length ? { category: nextCat } : {}),
        ...(nextSeller.length ? { seller: nextSeller } : {}),
      },
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const query = draft.trim()
    if (!query) return
    trackSearch(query)
    setSearch({ q: query })
  }

  function popularClick(term: string) {
    trackSearch(term)
    setSearch({ q: term })
  }

  const engine = productsQ.data?.engine
  const engineLabel =
    engine === "meilisearch"
      ? "Live catalog search"
      : engine === "medusa"
        ? "Catalog search"
        : null

  const multiFacet =
    active.category_handles.length + active.seller_handles.length > 1 ||
    (active.category_handles.length > 0 && active.seller_handles.length > 0)

  if (!hasQueryOrFilters) {
    return (
      <>
        <PageSeo title="Search" description="Search products on alkemart." path="/search" />
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-xl">
            <form onSubmit={submit} role="search" aria-label="Site search" className="relative">
              <span className="pointer-events-none absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-[#1a1a1a]/50">
                <IconSafe name="search" size={22} />
              </span>
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search alkemart"
                className="h-14 sm:h-16 w-full rounded-2xl border-0 bg-white/95 py-2 pl-12 sm:pl-14 pr-6 text-base sm:text-lg text-[#1a1a1a] shadow-lg shadow-black/5 outline-none placeholder:text-[#1a1a1a]/35 focus:ring-2 focus:ring-[#1a1a1a]/20 focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/30"
                aria-label="Search products"
                autoFocus
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>

            {recent.length > 0 && (
              <section className="mt-8 w-full" aria-label="Recent searches">
                <div className="flex flex-wrap gap-2">
                  {recent.map((term) => (
                    <span key={term} className="inline-flex items-center gap-1 rounded-xl border border-[#1a1a1a]/15 bg-white/70 px-4 py-2 text-sm text-[#1a1a1a] shadow-sm">
                      <button type="button" onClick={() => popularClick(term)} className="min-h-11 font-medium">{term}</button>
                      <button type="button" onClick={() => removeQuery(term)} className="ml-0.5 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[#1a1a1a]/40 hover:bg-[#1a1a1a]/10 hover:text-[#1a1a1a]" aria-label={`Remove ${term}`}>✕</button>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageSeo
        title={q ? `Search: ${q}` : "Search"}
        description={q ? `Search results for "${q}" on alkemart` : "Search products on alkemart."}
        path="/search"
        noindex={multiFacet || Boolean(q)}
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
        <form onSubmit={submit} role="search" aria-label="Site search" className="relative mb-6">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <IconSafe name="search" size={18} />
          </span>
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search rice, phones, fashion, shops…"
            className="h-12 w-full rounded-full border border-border bg-white py-2 pl-11 pr-24 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Search products"
            autoComplete="off"
            enterKeyHint="search"
          />
          <Button type="submit" size="lg" className="absolute right-1 top-1 min-h-10 rounded-full px-6">
            Search
          </Button>
        </form>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <SearchFacets
            className="rounded-2xl border border-border bg-card p-4"
            distribution={productsQ.data?.facetDistribution ?? {}}
            active={active}
            onChange={(next) =>
              setSearch({
                category: next.category_handles,
                seller: next.seller_handles,
              })
            }
          />

          <div className="min-w-0 space-y-4">
            {productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

            {productsQ.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {productsQ.error instanceof Error
                  ? productsQ.error.message
                  : "Search failed"}
              </p>
            ) : null}

            {productsQ.data && productsQ.data.products.length === 0 ? (
              <EmptyState
                illustration="emptyCatalog"
                title={q ? `No results for "${q}"` : "No matching products"}
                description="Try another term or clear filters."
                actionLabel="Browse all"
                actionTo="/"
              />
            ) : null}

            {productsQ.data && productsQ.data.products.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {productsQ.data.estimatedTotalHits}
                  </span>{" "}
                  result{productsQ.data.estimatedTotalHits === 1 ? "" : "s"}
                  {q ? <> for &ldquo;{q}&rdquo;</> : null}
                </p>
                <ProductGridShell>
                  {productsQ.data.products.map((p) => (
                    <ProductCard key={p.id} product={p} size="tile" />
                  ))}
                </ProductGridShell>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
