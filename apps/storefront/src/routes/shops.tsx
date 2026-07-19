import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { listStoreVendors } from "@/lib/vendors"
import { listStoreProducts } from "@/lib/products"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"

export const Route = createFileRoute("/shops")({
  component: SellersPage,
})

function SellersPage() {
  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
  })

  const productsQ = useQuery({
    queryKey: ["store", "products", "for-seller-index"],
    queryFn: () => listStoreProducts({ limit: 48 }),
    enabled: vendorsQ.isSuccess && (vendorsQ.data?.length ?? 0) === 0,
  })

  const fromApi = vendorsQ.data ?? []
  const fromProducts = (() => {
    if (fromApi.length) return []
    const map = new Map<string, { name: string; slug: string }>()
    for (const p of productsQ.data?.products ?? []) {
      const name = p.seller?.name?.trim()
      const slug = p.seller?.handle?.trim()
      if (!name || !slug) continue
      if (!map.has(slug)) map.set(slug, { name, slug })
    }
    return [...map.values()]
  })()

  const sellers =
    fromApi.length > 0
      ? fromApi.map((v) => ({
          name: v.name,
          slug: v.slug,
          bio: v.bio,
          source: "api" as const,
        }))
      : fromProducts.map((v) => ({
          name: v.name,
          slug: v.slug,
          bio: null as string | null,
          source: "catalog" as const,
        }))

  const loading =
    vendorsQ.isLoading ||
    (vendorsQ.isSuccess &&
      (vendorsQ.data?.length ?? 0) === 0 &&
      productsQ.isLoading)

  return (
    <div className="space-y-6">
      <header className="space-y-2 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Marketplace
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Sellers
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Shops selling on alkemart. Open a store to see their products.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {vendorsQ.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {vendorsQ.error instanceof Error
            ? vendorsQ.error.message
            : "Could not load sellers"}
        </p>
      ) : null}

      {!loading && sellers.length === 0 ? (
        <EmptyState
          illustration="marketplace"
          title="No sellers to show yet"
          description="No open shops yet."
          actionLabel="Browse products"
          actionTo="/"
        />
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sellers.map((s) => (
          <li key={s.slug}>
            <Link
              to="/shops/$slug"
              params={{ slug: s.slug }}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/25 text-xl font-bold text-foreground">
                  {s.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold tracking-tight group-hover:underline">
                    {s.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Visit store →</p>
                </div>
              </div>
              {s.bio ? (
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {s.bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Shop products from this seller when listings include seller
                  fields.
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
