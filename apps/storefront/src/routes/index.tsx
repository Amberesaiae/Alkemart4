import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { Button } from "@/components/ui/button"
import { LoadMore } from "@/components/load-more"
import { ProductGridSkeleton } from "@/components/skeleton"
import { IconChevronRight } from "@/components/icons"
import { HomeBento, HomeBentoSkeleton } from "@/components/home-bento"
import { listStoreCategories, listStoreProducts } from "@/lib/products"
import { listStoreVendors } from "@/lib/vendors"
import type { StoreProductCard } from "@/lib/products"

export const Route = createFileRoute("/")({
  component: HomePage,
})

const PAGE = 20

/**
 * Homepage architecture
 * ─────────────────────
 * 1. Department strip (categories API)
 * 2. Bento board (products + dept + seller tiles from API only)
 * 3. Shop-by-department grid
 * 4. Full assortment + load more
 *
 * Bento uses live catalog media — never invents products or prices.
 */
function HomePage() {
  const [limit, setLimit] = useState(PAGE)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["store", "products", "home", limit],
    queryFn: () => listStoreProducts({ limit }),
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
  })
  const vendorsQ = useQuery({
    queryKey: ["store", "vendors", "home"],
    queryFn: () => listStoreVendors(),
  })

  const products = data?.products ?? []
  const count = data?.count ?? products.length
  const categories = catsQ.data ?? []

  const sellers = (() => {
    if (vendorsQ.data && vendorsQ.data.length > 0) {
      return vendorsQ.data.map((v) => ({ name: v.name, slug: v.slug }))
    }
    const map = new Map<string, { name: string; slug: string }>()
    for (const p of products) {
      const name = p.seller?.name?.trim()
      const slug = p.seller?.handle?.trim()
      if (!name || !slug) continue
      if (!map.has(slug)) map.set(slug, { name, slug })
    }
    return [...map.values()]
  })()

  // Bento consumes first ~6; grid shows full list (overlap OK — retail norm)
  const bentoProducts = products.slice(0, 8)

  return (
    <div className="space-y-8 pb-2">
      {/* 1. Departments */}
      {categories.length > 0 ? (
        <section aria-label="Departments">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <Link
              to="/browse/$slug"
              params={{ slug: "all" }}
              className="shrink-0 border border-border bg-foreground px-3 py-2 text-xs font-semibold text-background"
            >
              All departments
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/browse/$slug"
                params={{ slug: c.handle || c.id }}
                className="shrink-0 border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 2. Bento */}
      {isLoading ? <HomeBentoSkeleton /> : null}
      {!isLoading && bentoProducts.length > 0 ? (
        <HomeBento
          products={bentoProducts}
          categories={categories}
          sellers={sellers}
        />
      ) : null}

      {/* 3. Department destinations */}
      {categories.length > 0 ? (
        <section className="space-y-3">
          <SectionHead
            title="Shop by department"
            href="/browse/$slug"
            hrefParams={{ slug: "all" }}
            linkLabel="View all"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                to="/browse/$slug"
                params={{ slug: c.handle || c.id }}
                className="flex items-center justify-between border border-border bg-card px-3 py-3 text-sm font-semibold hover:border-foreground"
              >
                <span className="line-clamp-1">{c.name}</span>
                <IconChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Sellers strip */}
      {sellers.length > 0 ? (
        <section className="space-y-3 border border-border bg-card p-4">
          <SectionHead title="Sellers" to="/sellers" linkLabel="All sellers" />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {sellers.slice(0, 10).map((s) => (
              <Link
                key={s.slug}
                to="/store/$slug"
                params={{ slug: s.slug }}
                className="flex shrink-0 items-center gap-2 border border-border bg-background px-3 py-2 text-sm hover:border-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center bg-muted text-xs font-bold">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[8rem] truncate font-medium">
                  {s.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Assortment */}
      <section className="space-y-4">
        <SectionHead
          title="All products"
          href="/browse/$slug"
          hrefParams={{ slug: "all" }}
          linkLabel="Browse"
        />

        {isLoading ? <ProductGridSkeleton count={8} /> : null}

        {isError ? (
          <div
            role="alert"
            className="border border-destructive/40 bg-destructive/5 p-4 text-sm"
          >
            <p className="font-semibold text-destructive">
              Could not load catalog
            </p>
            <p className="mt-1 text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {!isLoading && !isError && products.length === 0 ? (
          <div className="border border-dashed border-border px-6 py-12 text-center">
            <p className="font-semibold">No products in the catalog yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Publish offers in Mercur. Bento and grids only show API results.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/help">Help</Link>
            </Button>
          </div>
        ) : null}

        {products.length > 0 ? (
          <>
            <ProductGrid products={products} />
            <LoadMore
              shown={products.length}
              total={count}
              loading={isFetching && !isLoading}
              onLoadMore={() => setLimit((n) => n + PAGE)}
            />
          </>
        ) : null}
      </section>
    </div>
  )
}

function ProductGrid({ products }: { products: StoreProductCard[] }) {
  return (
    <ProductGridShell>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </ProductGridShell>
  )
}

function SectionHead(props: {
  title: string
  linkLabel: string
  to?: "/sellers"
  href?: "/browse/$slug"
  hrefParams?: { slug: string }
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight sm:text-lg">
        {props.title}
      </h2>
      {props.to ? (
        <Link
          to={props.to}
          className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {props.linkLabel}
        </Link>
      ) : props.href && props.hrefParams ? (
        <Link
          to={props.href}
          params={props.hrefParams}
          className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {props.linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
