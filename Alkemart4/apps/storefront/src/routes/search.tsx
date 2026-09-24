import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { X } from "@phosphor-icons/react"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton } from "@/components/skeleton"
import { Button } from "@workspace/ui"
import {
  SearchFacets,
  type ActiveFilters,
} from "@/components/search-facets"
import { searchCatalog } from "@/lib/search"
import {
  trackSearchLandingViewed,
  trackSearchPerformed,
  trackSearchZeroResults,
  trackFilterApplied,
  trackFilterRemoved,
} from "@/lib/analytics"
import { Container } from "@workspace/ui"
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
  min_price?: number
  max_price?: number
  sort?: "relevance" | "price_asc" | "price_desc"
  in_stock?: boolean
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteSearch => {
    const q = typeof search.q === "string" ? search.q : ""
    const category = parseList(search.category)
    const seller = parseList(search.seller)
    const min_price =
      typeof search.min_price === "number"
        ? search.min_price
        : typeof search.min_price === "string" && !isNaN(Number(search.min_price))
          ? Number(search.min_price)
          : undefined
    const max_price =
      typeof search.max_price === "number"
        ? search.max_price
        : typeof search.max_price === "string" && !isNaN(Number(search.max_price))
          ? Number(search.max_price)
          : undefined
    const sort =
      search.sort === "price_asc" || search.sort === "price_desc"
        ? (search.sort as "price_asc" | "price_desc")
        : undefined
    const in_stock =
      search.in_stock === true || search.in_stock === "true" ? true : undefined

    return {
      q: q || undefined,
      ...(category.length ? { category } : {}),
      ...(seller.length ? { seller } : {}),
      ...(min_price != null ? { min_price } : {}),
      ...(max_price != null ? { max_price } : {}),
      ...(sort ? { sort } : {}),
      ...(in_stock ? { in_stock } : {}),
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
  const { min_price, max_price, sort, in_stock } = search
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
    active.seller_handles.length > 0 ||
    min_price != null ||
    max_price != null ||
    in_stock != null ||
    sort != null

  const productsQ = useQuery({
    queryKey: [
      "store",
      "search",
      q,
      active.category_handles.join(","),
      active.seller_handles.join(","),
      min_price,
      max_price,
    ],
    queryFn: () =>
      searchCatalog({
        q,
        limit: 48,
        filters: {
          category_handles: active.category_handles,
          seller_handles: active.seller_handles,
          min_price,
          max_price,
        },
      }),
    enabled: hasQueryOrFilters,
  })

  const filteredProducts = useMemo(() => {
    let prods = productsQ.data?.products ?? []
    if (min_price != null) {
      prods = prods.filter((p) => (p.amount ?? 0) >= min_price)
    }
    if (max_price != null) {
      prods = prods.filter((p) => (p.amount ?? 0) <= max_price)
    }
    if (in_stock) {
      prods = prods.filter((p) => (p.availableQty ?? 0) > 0)
    }
    if (sort === "price_asc") {
      prods = [...prods].sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))
    } else if (sort === "price_desc") {
      prods = [...prods].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    }
    return prods
  }, [productsQ.data?.products, min_price, max_price, in_stock, sort])

  useEffect(() => {
    if (!q || !productsQ.isSuccess) return
    trackSearchPerformed(q, productsQ.data.estimatedTotalHits)
    if (productsQ.data.estimatedTotalHits === 0) {
      trackSearchZeroResults({ query: q })
    }
  }, [q, productsQ.isSuccess, productsQ.data?.estimatedTotalHits])

  useEffect(() => {
    if (hasQueryOrFilters) return
    trackSearchLandingViewed()
  }, [hasQueryOrFilters])

  function setSearch(next: {
    q?: string
    category?: string[]
    seller?: string[]
    min_price?: number
    max_price?: number
    sort?: "relevance" | "price_asc" | "price_desc"
    in_stock?: boolean
  }) {
    const nextQ = next.q !== undefined ? next.q : qParam
    const nextCat = next.category !== undefined ? next.category : category
    const nextSeller = next.seller !== undefined ? next.seller : seller
    const nextMin = next.min_price !== undefined ? next.min_price : min_price
    const nextMax = next.max_price !== undefined ? next.max_price : max_price
    const nextSort = next.sort !== undefined ? next.sort : sort
    const nextInStock = next.in_stock !== undefined ? next.in_stock : in_stock

    void navigate({
      to: "/search",
      search: {
        ...(nextQ ? { q: nextQ } : {}),
        ...(nextCat.length ? { category: nextCat } : {}),
        ...(nextSeller.length ? { seller: nextSeller } : {}),
        ...(nextMin != null ? { min_price: nextMin } : {}),
        ...(nextMax != null ? { max_price: nextMax } : {}),
        ...(nextSort ? { sort: nextSort } : {}),
        ...(nextInStock ? { in_stock: nextInStock } : {}),
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
    engine === "workers" || engine === "meilisearch"
      ? "Live catalog search"
      : engine === "medusa"
        ? "Catalog search"
        : null

  // Facets panel hides itself when the API has no facet data; the results
  // must then take the full width instead of sitting in the 220px column.
  const facetDistribution = productsQ.data?.facetDistribution
  const hasFacets =
    !!facetDistribution &&
    Object.values(facetDistribution).some(
      (counts) => counts && Object.keys(counts).length > 0,
    )

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
              <span className="pointer-events-none absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-foreground/50">
                <IconSafe name="search" size={22} />
              </span>
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search alkemart"
                className="h-14 sm:h-16 w-full rounded-2xl border-0 bg-background/95 py-2 pl-12 sm:pl-14 pr-6 text-base sm:text-lg text-foreground shadow-lg shadow-black/5 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring/30"
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
                    <span key={term} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/70 px-4 py-2 text-sm text-foreground shadow-sm">
                      <button type="button" onClick={() => popularClick(term)} className="min-h-11 font-medium">{term}</button>
                      <button type="button" onClick={() => removeQuery(term)} className="ml-0.5 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${term}`}><X size={16} weight="bold" aria-hidden /></button>
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
      <Container className="py-5 sm:py-6">
        <form onSubmit={submit} role="search" aria-label="Site search" className="relative mb-6">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <IconSafe name="search" size={18} />
          </span>
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search rice, phones, fashion, shops…"
            className="h-11 w-full rounded-md border border-border/80 bg-background py-2 pl-11 pr-24 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Search products"
            autoComplete="off"
            enterKeyHint="search"
          />
          <Button type="submit" size="default" className="absolute right-1 top-1 h-9 rounded px-5 text-xs font-bold uppercase tracking-wider">
            Search
          </Button>
        </form>

        <div
          className={
            hasFacets
              ? "grid gap-6 lg:grid-cols-[240px_1fr]"
              : "space-y-4"
          }
        >
          {hasFacets ? (
            <SearchFacets
              className="rounded-md border border-border/80 bg-card p-4 shadow-2xs"
              distribution={facetDistribution ?? {}}
              active={active}
              onChange={(next) => {
                const prevCats = new Set(active.category_handles)
                const prevSellers = new Set(active.seller_handles)
                for (const h of next.category_handles) {
                  if (!prevCats.has(h)) trackFilterApplied({ dimension: "category", value: h })
                }
                for (const h of active.category_handles) {
                  if (!next.category_handles.includes(h)) {
                    trackFilterRemoved({ dimension: "category", value: h })
                  }
                }
                for (const h of next.seller_handles) {
                  if (!prevSellers.has(h)) trackFilterApplied({ dimension: "seller", value: h })
                }
                for (const h of active.seller_handles) {
                  if (!next.seller_handles.includes(h)) {
                    trackFilterRemoved({ dimension: "seller", value: h })
                  }
                }
                setSearch({
                  category: next.category_handles,
                  seller: next.seller_handles,
                })
              }}
            />
          ) : null}

          <div className="min-w-0 space-y-4">
            {/* Applied filters bar */}
            {(category.length > 0 || seller.length > 0 || min_price != null || max_price != null || in_stock || sort) && (
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Filters:
                </span>
                {category.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground border border-border/80"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => setSearch({ category: category.filter((x) => x !== c) })}
                      className="hover:text-primary-strong text-muted-foreground"
                      aria-label={`Remove category ${c}`}
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </span>
                ))}
                {seller.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground border border-border/80"
                  >
                    <span>Seller: {s}</span>
                    <button
                      type="button"
                      onClick={() => setSearch({ seller: seller.filter((x) => x !== s) })}
                      className="hover:text-primary-strong text-muted-foreground"
                      aria-label={`Remove seller ${s}`}
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </span>
                ))}
                {(min_price != null || max_price != null) && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground border border-border/80">
                    <span>
                      GH₵{min_price ?? 0} – {max_price != null ? `GH₵${max_price}` : "Above"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearch({ min_price: undefined, max_price: undefined })}
                      className="hover:text-primary-strong text-muted-foreground"
                      aria-label="Remove price filter"
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </span>
                )}
                {in_stock && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground border border-border/80">
                    <span>In stock only</span>
                    <button
                      type="button"
                      onClick={() => setSearch({ in_stock: undefined })}
                      className="hover:text-primary-strong text-muted-foreground"
                      aria-label="Remove in stock filter"
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </span>
                )}
                {sort && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground border border-border/80">
                    <span>
                      Sort: {sort === "price_asc" ? "Price: Low to High" : "Price: High to Low"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearch({ sort: undefined })}
                      className="hover:text-primary-strong text-muted-foreground"
                      aria-label="Remove sort filter"
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setSearch({
                      category: [],
                      seller: [],
                      min_price: undefined,
                      max_price: undefined,
                      in_stock: undefined,
                      sort: undefined,
                    })
                  }
                  className="text-xs font-bold text-primary-strong hover:underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

            {productsQ.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {productsQ.error instanceof Error
                  ? productsQ.error.message
                  : "Search failed"}
              </p>
            ) : null}

            {productsQ.data && filteredProducts.length === 0 ? (
              <>
                <EmptyState
                  illustration="emptyCatalog"
                  title={q ? `No results for "${q}"` : "No matching products"}
                  description={
                    productsQ.data.appliedAlias
                      ? `Including matches for "${productsQ.data.query}" — try another term or clear filters.`
                      : "Try another term or clear filters."
                  }
                  actionLabel="Browse all"
                  actionTo="/"
                />
                {(() => {
                  const suggestions = productsQ.data.suggestions
                  if (!suggestions) return null
                  const cats = suggestions.categories ?? []
                  const shops = suggestions.shops ?? []
                  if (cats.length === 0 && shops.length === 0) return null
                  return (
                    <div className="space-y-3">
                      {cats.length > 0 ? (
                        <div>
                          <p className="mb-2 text-sm font-bold">Related categories</p>
                          <div className="flex flex-wrap gap-2">
                            {cats.map((c) => (
                              <Link
                                key={c.id}
                                to="/categories/$slug"
                                params={{ slug: c.slug }}
                                className="rounded-md border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary"
                              >
                                {c.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {shops.length > 0 ? (
                        <div>
                          <p className="mb-2 text-sm font-bold">Matching shops</p>
                          <div className="flex flex-wrap gap-2">
                            {shops.map((s) => (
                              <Link
                                key={s.handle}
                                to="/shops/$slug"
                                params={{ slug: s.handle }}
                                className="rounded-md border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary"
                              >
                                {s.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}
              </>
            ) : null}

            {productsQ.data && filteredProducts.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {filteredProducts.length}
                  </span>{" "}
                  result{filteredProducts.length === 1 ? "" : "s"}
                  {q ? <> for &ldquo;{q}&rdquo;</> : null}
                </p>
                <ProductGridShell>
                  {filteredProducts.map((p) => (
                    <ProductCard key={p.id} product={p} size="tile" />
                  ))}
                </ProductGridShell>
              </>
            ) : null}
          </div>
        </div>
      </Container>
    </>
  )
}
