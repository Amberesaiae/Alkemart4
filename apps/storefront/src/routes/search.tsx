import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
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
import { POPULAR_SEARCHES } from "@/lib/popular-searches"
import { listStoreCategories } from "@/lib/products"

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
    // Omit empty arrays so header/footer can navigate with { q } only
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

  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    enabled: !hasQueryOrFilters,
  })

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
    setSearch({ q: draft.trim() })
  }

  const engine = productsQ.data?.engine
  const engineLabel =
    engine === "meilisearch"
      ? "Live catalog search"
      : engine === "medusa"
        ? "Catalog search"
        : null

  // Multi-facet URLs: noindex to avoid crawl explosion (SEO plan Phase 3)
  const multiFacet =
    active.category_handles.length + active.seller_handles.length > 1 ||
    (active.category_handles.length > 0 && active.seller_handles.length > 0)

  return (
    <div className="space-y-6">
      <PageSeo
        title={q ? `Search: ${q}` : "Search"}
        description={
          q
            ? `Search results for “${q}” on alkemart`
            : "Search products on alkemart."
        }
        path="/search"
        noindex={multiFacet || Boolean(q)}
      />
      <header className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Search alkemart
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {engineLabel ?? "Search products and sellers."}
          </p>
        </div>
        <form onSubmit={submit} className="flex">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search rice, phones, fashion, shops…"
            className="h-12 min-h-12 flex-1 border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground focus:ring-1 focus:ring-foreground"
            aria-label="Search products"
            autoFocus
          />
          <Button
            type="submit"
            size="lg"
            className="min-h-12 rounded-none border border-l-0 border-border px-8"
          >
            Search
          </Button>
        </form>
      </header>

      {!hasQueryOrFilters ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold tracking-tight">
              Popular right now
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One tap — same as the header search, tracked for discovery.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold transition hover:border-foreground hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    track("search_suggestion_clicked", {
                      query: term,
                      surface: "search_landing",
                    })
                    setSearch({ q: term })
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          </section>

          {(catsQ.data?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold tracking-tight">
                Browse departments
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                {catsQ.data!.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    to="/categories/$slug"
                    params={{ slug: c.handle || c.id }}
                    className="border border-border bg-background px-3 py-3 text-sm font-semibold hover:border-foreground"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <p className="text-center text-sm text-muted-foreground">
            Or{" "}
            <Link
              to="/categories/$slug"
              params={{ slug: "all" }}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              browse all products
            </Link>
          </p>
        </div>
      ) : null}

      {hasQueryOrFilters ? (
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
                title={q ? `No results for “${q}”` : "No matching products"}
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
                  result
                  {productsQ.data.estimatedTotalHits === 1 ? "" : "s"}
                  {q ? (
                    <>
                      {" "}
                      for “{q}”
                    </>
                  ) : null}
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
      ) : null}
    </div>
  )
}
