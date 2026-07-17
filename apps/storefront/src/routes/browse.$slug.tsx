import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { LoadMore } from "@/components/load-more"
import { ProductGridSkeleton } from "@/components/skeleton"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/browse/$slug")({
  component: BrowsePage,
})

const PAGE = 24

function BrowsePage() {
  const { slug } = Route.useParams()
  const isAll = slug === "all" || slug === ""
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    setLimit(PAGE)
  }, [slug])

  const categoriesQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
  })

  const category =
    !isAll && categoriesQ.data
      ? categoriesQ.data.find((c) => c.handle === slug || c.id === slug)
      : undefined

  const categoryId = category?.id

  const productsQ = useQuery({
    queryKey: ["store", "products", "browse", slug, categoryId, limit],
    queryFn: () =>
      listStoreProducts({
        limit,
        categoryId: isAll ? undefined : categoryId,
      }),
    enabled: isAll || categoriesQ.isSuccess || categoriesQ.isError,
  })

  const title = isAll
    ? "All products"
    : category?.name ?? (categoriesQ.isLoading ? "…" : "Category")

  const missingCategory = !isAll && categoriesQ.isSuccess && !category
  const products = productsQ.data?.products ?? []
  const count = productsQ.data?.count ?? products.length

  return (
    <div className="space-y-6">
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
            {productsQ.data ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {count} product{count === 1 ? "" : "s"}
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

      {productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

      {productsQ.isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">Could not load products</p>
          <p className="text-muted-foreground">
            {productsQ.error instanceof Error
              ? productsQ.error.message
              : "Unknown error"}
          </p>
        </div>
      ) : null}

      {!missingCategory && productsQ.data && products.length === 0 ? (
        <EmptyState
          title="No products in this view"
          description="Publish offers in Mercur or pick another category."
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
            loading={productsQ.isFetching && !productsQ.isLoading}
            onLoadMore={() => setLimit((n) => n + PAGE)}
          />
        </>
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
