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
import { trackSearchPerformed } from "@/lib/analytics"

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

  return (
    <div className="space-y-6">
      <header className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Search
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {engineLabel ??
              "Search published products. Filters appear after search sync."}
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search products…"
            className="h-12 min-h-12 flex-1 rounded-xl border border-border bg-muted/40 px-4 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/30"
            aria-label="Search products"
            autoFocus
          />
          <Button type="submit" size="lg" className="min-h-12 rounded-xl px-8">
            Search
          </Button>
        </form>
      </header>

      {!hasQueryOrFilters ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Type a query above, or{" "}
            <Link
              to="/browse/$slug"
              params={{ slug: "all" }}
              className="font-semibold underline"
            >
              browse all products
            </Link>
            .
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
                title={q ? `No results for “${q}”` : "No matching products"}
                description="Try another term, clear filters, or browse the full catalog."
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
                    <ProductCard key={p.id} product={p} />
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
