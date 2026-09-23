import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { Breadcrumbs } from "@/components/shell/Breadcrumbs"
import { PageSeo } from "@/components/page-seo"
import { truncateMeta } from "@/lib/seo"
import { getStoreCollection, getStoreVendorBySlug } from "@/lib/vendors"

export const Route = createFileRoute("/shops/collections/$collectionId")({
  validateSearch: (search: Record<string, unknown>): { shop: string } => ({
    shop: typeof search.shop === "string" && search.shop.trim() ? search.shop : "",
  }),
  component: CollectionPage,
})

/**
 * One vendor shelf (Phase 4A): live collection with its ranked cards.
 * Draft, scheduled-future, and expired shelves read as missing — the page
 * shows a dead-end-free empty state back to the shop, never a 404 wall.
 */
function CollectionPage() {
  const { collectionId } = Route.useParams()
  const { shop } = Route.useSearch()

  const vendorQ = useQuery({
    queryKey: ["store", "vendor", shop],
    queryFn: () => getStoreVendorBySlug(shop),
  })
  const sellerId = vendorQ.data?.vendor.id ?? ""

  const shelfQ = useQuery({
    queryKey: ["store", "collection", sellerId, collectionId],
    queryFn: () => getStoreCollection(sellerId, collectionId),
    enabled: Boolean(sellerId),
  })

  const shelf = shelfQ.data ?? null
  const vendorName = vendorQ.data?.vendor.name ?? "Shop"

  if (vendorQ.isError || (vendorQ.isSuccess && !vendorQ.data)) {
    return (
      <div className="space-y-6 pb-8">
        <EmptyState
          title="Shop not found"
          description="This shelf's shop is gone. Browse the market instead."
          actionLabel="Browse all"
          actionTo="/categories/$slug"
          actionParams={{ slug: "all" }}
        />
      </div>
    )
  }

  if (shelfQ.isSuccess && !shelf) {
    return (
      <div className="space-y-6 pb-8">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: vendorName, to: "/shops/$slug", params: { slug: shop } },
            { label: "Shelf" },
          ]}
        />
        <EmptyState
          title="Shelf unavailable"
          description="This shelf is draft, scheduled, expired, or removed."
          actionLabel={`Back to ${vendorName}`}
          actionTo="/shops/$slug"
          actionParams={{ slug: shop }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {shelf ? (
        <PageSeo
          title={`${shelf.name} · ${vendorName}`}
          description={
            shelf.description
              ? truncateMeta(shelf.description)
              : `${shelf.name} — a shelf by ${vendorName} on alkemart`
          }
          path={`/shops/collections/${shelf.id}?shop=${shop}`}
        />
      ) : null}
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: vendorName, to: "/shops/$slug", params: { slug: shop } },
          { label: shelf?.name ?? "Shelf" },
        ]}
      />
      {shelfQ.isLoading || vendorQ.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading shelf">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : null}
      {shelf ? (
        <>
          <header className="space-y-1">
            <h1 className="type-pdp-title text-foreground">{shelf.name}</h1>
            <p className="text-sm text-muted-foreground">
              A shelf by{" "}
              <Link
                to="/shops/$slug"
                params={{ slug: shop }}
                className="font-bold text-primary hover:underline"
              >
                {vendorName}
              </Link>{" "}
              · {shelf.cards.length} {shelf.cards.length === 1 ? "item" : "items"}
            </p>
            {shelf.description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {shelf.description}
              </p>
            ) : null}
          </header>
          {shelf.cards.length > 0 ? (
            <ProductGridShell>
              {shelf.cards.map((card) => (
                <ProductCard key={card.id} product={card} size="store" />
              ))}
            </ProductGridShell>
          ) : (
            <EmptyState
              title="Shelf is empty"
              description="Every item sold through or was removed. The shop has more."
              actionLabel={`Back to ${vendorName}`}
              actionTo="/shops/$slug"
              actionParams={{ slug: shop }}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
