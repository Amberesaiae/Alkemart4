import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton } from "@/components/skeleton"
import { Button } from "@/components/ui/button"
import { listStoreProducts } from "@/lib/products"
import { trackSearchPerformed } from "@/lib/analytics"

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
})

function SearchPage() {
  const navigate = useNavigate()
  const { q: qParam } = Route.useSearch()
  const [draft, setDraft] = useState(qParam)

  useEffect(() => {
    setDraft(qParam)
  }, [qParam])

  const q = qParam.trim()
  const productsQ = useQuery({
    queryKey: ["store", "products", "search", q],
    queryFn: () => listStoreProducts({ limit: 48, q }),
    enabled: q.length > 0,
  })

  useEffect(() => {
    if (!q || !productsQ.isSuccess) return
    trackSearchPerformed(q, productsQ.data.products.length)
  }, [q, productsQ.isSuccess, productsQ.data?.products.length])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = draft.trim()
    void navigate({
      to: "/search",
      search: { q: next },
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Search
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Results from the store product API only.
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

      {!q ? (
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

      {q && productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

      {q && productsQ.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {productsQ.error instanceof Error
            ? productsQ.error.message
            : "Search failed"}
        </p>
      ) : null}

      {q && productsQ.data && productsQ.data.products.length === 0 ? (
        <EmptyState
          title={`No results for “${q}”`}
          description="Try another term, or browse the full catalog."
          actionLabel="Browse all"
          actionTo="/"
        />
      ) : null}

      {productsQ.data && productsQ.data.products.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {productsQ.data.count}
            </span>{" "}
            result{productsQ.data.count === 1 ? "" : "s"} for “{q}”
          </p>
          <ProductGridShell>
            {productsQ.data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductGridShell>
        </>
      ) : null}
    </div>
  )
}
