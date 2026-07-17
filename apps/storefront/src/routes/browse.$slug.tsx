import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { LoadMore } from "@/components/load-more"
import { ProductGridSkeleton } from "@/components/skeleton"
import {
  SearchFacets,
  type ActiveFilters,
} from "@/components/search-facets"
import { PageSeo } from "@/components/page-seo"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { searchCatalog } from "@/lib/search"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/browse/$slug")({
  validateSearch: (search: Record<string, unknown>) => {
    const seller = parseList(search.seller)
    return seller.length ? { seller } : {}
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

const PAGE = 24

function BrowsePage() {
  const navigate = useNavigate()
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const sellerFilters = search.seller ?? []
  const isAll = slug === "all" || slug === ""
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    setLimit(PAGE)
  }, [slug, sellerFilters.join(",")])

  const categoriesQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
  })

  const category =
    !isAll && categoriesQ.data
      ? categoriesQ.data.find((c) => c.handle === slug || c.id === slug)
      : undefined

  const categoryId = category?.id
  const categoryHandle = category?.handle ?? (!isAll ? slug : undefined)

  const active: ActiveFilters = useMemo(
    () => ({
      category_handles: [],
      seller_handles: sellerFilters,
    }),
    [sellerFilters],
  )

  /** Prefer Meilisearch discovery when available; fall back to product.list */
  const discoveryQ = useQuery({
    queryKey: [
      "store",
      "browse-discovery",
      slug,
      categoryHandle,
      sellerFilters.join(","),
      limit,
    ],
    queryFn: () =>
      searchCatalog({
        q: "",
        limit,
        filters: {
          category_handles:
            !isAll && categoryHandle ? [categoryHandle] : undefined,
          seller_handles: sellerFilters.length ? sellerFilters : undefined,
        },
      }),
    enabled: isAll || categoriesQ.isSuccess || categoriesQ.isError,
  })

  const useMeili = discoveryQ.data?.engine === "meilisearch"

  const productsQ = useQuery({
    queryKey: ["store", "products", "browse", slug, categoryId, limit],
    queryFn: () =>
      listStoreProducts({
        limit,
        categoryId: isAll ? undefined : categoryId,
      }),
    enabled:
      (isAll || categoriesQ.isSuccess || categoriesQ.isError) &&
      discoveryQ.isSuccess &&
      !useMeili,
  })

  const title = isAll
    ? "All products"
    : category?.name ?? (categoriesQ.isLoading ? "…" : "Category")

  const missingCategory = !isAll && categoriesQ.isSuccess && !category

  const products = useMeili
    ? (discoveryQ.data?.products ?? [])
    : (productsQ.data?.products ?? [])
  const count = useMeili
    ? (discoveryQ.data?.estimatedTotalHits ?? products.length)
    : (productsQ.data?.count ?? products.length)

  const loading =
    discoveryQ.isLoading || (!useMeili && productsQ.isLoading)
  const error = useMeili ? discoveryQ.isError : productsQ.isError
  const errMsg = useMeili ? discoveryQ.error : productsQ.error
  const fetching =
    discoveryQ.isFetching || (!useMeili && productsQ.isFetching)

  return (
    <div className="space-y-6">
      <PageSeo
        title={title}
        description={
          isAll
            ? "Browse products from Ghana sellers on alkemart."
            : `Browse ${title} on alkemart.`
        }
        path={`/browse/${slug}`}
        noindex={sellerFilters.length > 0}
      />

      <header className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <nav className="text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1">/</span>
          <span className="font-medium text-foreground">{title}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {!loading ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {count} product{count === 1 ? "" : "s"}
                {useMeili ? " · live catalog" : null}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {categoriesQ.data && categoriesQ.data.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <ChipLink to="/browse/$slug" params={{ slug: "all" }} active={isAll}>
            All
          </ChipLink>
          {categoriesQ.data.map((c) => {
            const s = c.handle || c.id
            return (
              <ChipLink
                key={c.id}
                to="/browse/$slug"
                params={{ slug: s }}
                active={slug === s}
              >
                {c.name}
              </ChipLink>
            )
          })}
        </div>
      ) : null}

      {missingCategory ? (
        <EmptyState
          title="Category not found"
          description="No matching category from the store API. Showing nothing rather than inventing products."
          actionLabel="All products"
          actionTo="/"
        />
      ) : null}

      {!missingCategory ? (
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {useMeili ? (
            <SearchFacets
              className="rounded-2xl border border-border bg-card p-4"
              distribution={discoveryQ.data?.facetDistribution ?? {}}
              active={active}
              onChange={(next) => {
                void navigate({
                  to: "/browse/$slug",
                  params: { slug },
                  search: next.seller_handles.length
                    ? { seller: next.seller_handles }
                    : {},
                })
              }}
            />
          ) : (
            <aside className="hidden text-xs text-muted-foreground lg:block">
              Seller filters appear after search sync is enabled.
            </aside>
          )}

          <div className="min-w-0 space-y-4">
            {loading ? <ProductGridSkeleton count={8} /> : null}

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
              >
                <p className="font-semibold text-destructive">
                  Could not load products
                </p>
                <p className="text-muted-foreground">
                  {errMsg instanceof Error ? errMsg.message : "Unknown error"}
                </p>
              </div>
            ) : null}

            {!loading && products.length === 0 ? (
              <EmptyState
                title="No products in this view"
                description="Publish offers in Mercur, clear seller filters, or pick another category."
                actionLabel="Home"
                actionTo="/"
              />
            ) : null}

            {products.length > 0 ? (
              <>
                <ProductGridShell>
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </ProductGridShell>
                <LoadMore
                  shown={products.length}
                  total={count}
                  loading={fetching && !loading}
                  onLoadMore={() => setLimit((n) => n + PAGE)}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChipLink(props: {
  to: "/browse/$slug"
  params: { slug: string }
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={props.to}
      params={props.params}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition",
        props.active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
      )}
    >
      {props.children}
    </Link>
  )
}
