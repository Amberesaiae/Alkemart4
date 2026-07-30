import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/route-guards"
import { getWishlist, removeFromWishlist } from "@/lib/wishlist"
import { Skeleton } from "@/components/skeleton"
import { Button } from "@workspace/ui"
import { EmptyState } from "@/components/empty-state"
import { useCallback, useState } from "react"

export const Route = createFileRoute("/account/wishlist")({
  beforeLoad: async () => {
    const customer = await requireAuth()
    return { customer }
  },
  component: WishlistPage,
})

function WishlistPage() {
  const [removing, setRemoving] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["store", "wishlist"],
    queryFn: () => getWishlist(),
  })

  const handleRemove = useCallback(
    async (productId: string) => {
      setRemoving(productId)
      try {
        await removeFromWishlist(productId)
        await refetch()
      } catch {
        /* swallow */
      }
      setRemoving(null)
    },
    [refetch],
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6" role="status" aria-label="Loading wishlist">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          illustration="emptyCart"
          title="Could not load wishlist"
          description={error instanceof Error ? error.message : "Something went wrong"}
          actionLabel="Try again"
          actionOnClick={() => refetch()}
        />
      </div>
    )
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          illustration="emptyCart"
          title="Your wishlist is empty"
          description="Save items you love and come back to them later."
          actionLabel="Browse products"
          actionTo="/"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Your wishlist
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({data.count} item{data.count !== 1 ? "s" : ""})
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Products you've saved for later.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.products.map((product) => (
          <div
            key={product.id}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card"
          >
            <Link
              to={"/product/$id"}
              params={{ id: product.handle || product.id }}
              className="block"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="truncate text-sm font-semibold">
                  {product.title}
                </h3>
              </div>
            </Link>
            <div className="absolute right-2 top-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={removing === product.id}
                className="h-8 w-8 rounded-full bg-white/80 p-0 text-xs shadow-sm hover:bg-white hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleRemove(product.id)
                }}
                aria-label={`Remove ${product.title} from wishlist`}
              >
                {removing === product.id ? "…" : "✕"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
