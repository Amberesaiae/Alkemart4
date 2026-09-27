import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductGrid } from "@/components/commerce/product-grid"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { getStoreCollection, getStoreVendorBySlug } from "@/lib/vendors"

export const Route = createFileRoute("/shops/collections/$collectionId")({
  validateSearch: (s: Record<string, unknown>): { shop: string } => ({
    shop: typeof s.shop === "string" ? s.shop.trim() : "",
  }),
  component: CollectionPage,
})

/** One live seller shelf. Draft/expired shelves read as missing, with a way back. */
function CollectionPage() {
  const { collectionId } = Route.useParams()
  const { shop } = Route.useSearch()
  const vendorQ = useQuery({ queryKey: ["store", "vendor", shop], queryFn: () => getStoreVendorBySlug(shop), enabled: Boolean(shop) })
  const sellerId = vendorQ.data?.vendor.id ?? ""
  const shelfQ = useQuery({
    queryKey: ["store", "collection", sellerId, collectionId],
    queryFn: () => getStoreCollection(sellerId, collectionId),
    enabled: Boolean(sellerId),
  })
  const shelf = shelfQ.data
  const shopName = vendorQ.data?.vendor.name ?? "the shop"

  if (!shop || vendorQ.isError) {
    return (
      <div className="container-page py-10">
        {vendorQ.isError && !(vendorQ.error instanceof Error && vendorQ.error.message === "Store not found") ? (
          <ErrorState error={vendorQ.error} onRetry={() => void vendorQ.refetch()} />
        ) : (
          <EmptyState title="Shop not found" action={{ label: "Browse stores", to: "/shops" }} />
        )}
      </div>
    )
  }
  if (shelfQ.isSuccess && !shelf) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title="This collection isn't live"
          description="It may have ended or not started yet."
          action={{ label: `Back to ${shopName}`, to: "/shops/$slug", params: { slug: shop } }}
        />
      </div>
    )
  }
  return (
    <div className="container-page space-y-6 pt-6">
      <PageSeo title={shelf?.name ?? "Collection"} description={shelf?.description ?? undefined} path={`/shops/collections/${collectionId}?shop=${shop}`} />
      <div className="space-y-2">
        <Link to="/shops/$slug" params={{ slug: shop }} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← {shopName}
        </Link>
        <h1 className="text-3xl font-extrabold">{shelf?.name ?? "…"}</h1>
        {shelf?.description ? <p className="max-w-2xl text-muted-foreground">{shelf.description}</p> : null}
      </div>
      {shelf?.imageUrl ? <img src={shelf.imageUrl} alt="" className="h-48 w-full rounded-[2rem] object-cover sm:h-64" /> : null}
      <ProductGrid products={shelf?.cards ?? []} loading={vendorQ.isLoading || shelfQ.isLoading} />
    </div>
  )
}
