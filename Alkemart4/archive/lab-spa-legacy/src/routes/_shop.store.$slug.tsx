import { createFileRoute, Link } from "@tanstack/react-router"
import { useListProducts } from "@/lib/hooks-products"
import { useGetVendorBySlug } from "@/lib/hooks-vendors"
import { useAddCartItem } from "@/lib/hooks-cart"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { ProductCard } from "@/components/shop/product-card"
import { RatingStars } from "@/components/shop/rating-stars"
import { ImageSlot } from "@/components/shop/image-slot"
import { Button } from "@/components/ui/button"
import { pesewasToPrice } from "@/lib/money"
import { ShopPage } from "@/components/shop/shop-page"

export const Route = createFileRoute("/_shop/store/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} — alkemart Ghana` }],
  }),
  component: StorePage,
})

function StorePage() {
  const { slug } = Route.useParams()
  const {
    data: vendor,
    isLoading: vendorLoading,
    isError: vendorError,
    error: vendorErr,
    refetch: refetchVendor,
  } = useGetVendorBySlug(slug)

  const {
    data: productData,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useListProducts(
    { limit: 48 },
    { query: { enabled: Boolean(vendor?.slug) } },
  )

  const addCartItem = useAddCartItem()

  // Prefer products tagged with this vendor (metadata); fall back to none rather than all catalog
  const products = (productData?.items ?? []).filter(
    (p) => p.vendor?.slug === slug || p.vendor?.slug === vendor?.slug,
  )

  if (vendorLoading) {
    return (
      <ShopPage dense className="space-y-6 py-8">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-36 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </ShopPage>
    )
  }

  if (vendorError || !vendor) {
    return (
      <ShopPage className="py-16 text-center">
        <h1 className="font-display text-xl font-bold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {vendorErr instanceof Error
            ? vendorErr.message
            : `We couldn't find a storefront for “${slug}”.`}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetchVendor()}>
            Try again
          </Button>
          <Button asChild size="sm">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </ShopPage>
    )
  }

  return (
    <ShopPage dense className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{vendor.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="rounded-md border border-border bg-surface p-6">
        <div className="grid gap-6 md:grid-cols-[120px_1fr]">
          <div className="w-[120px]">
            <ImageSlot
              ratio={1}
              rounded="md"
              tone="brand"
              src={vendor.logoImageUrl ?? undefined}
              alt={vendor.name}
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{vendor.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <RatingStars
                rating={
                  vendor.ratingCount > 0 ? vendor.ratingAvgX100 / 100 : 0
                }
                count={
                  vendor.ratingCount > 0
                    ? `${vendor.ratingCount} reviews`
                    : undefined
                }
              />
              {vendor.badgeTopSeller && (
                <Badge variant="secondary">Top seller</Badge>
              )}
              {vendor.badgeFastShipper && (
                <Badge variant="secondary">Fast shipper</Badge>
              )}
            </div>
            {vendor.bio && (
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                {vendor.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">Products</span>
            {!productsLoading && ` (${products.length})`}
          </span>
        </div>

        {productsError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">
              Could not load products for this store.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetchProducts()}
            >
              Retry
            </Button>
          </div>
        )}

        {!productsError && productsLoading && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        )}

        {!productsError && !productsLoading && products.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            This store has no products listed yet. Products appear here when
            they are linked to this seller.
          </p>
        )}

        {!productsError && !productsLoading && products.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                title={p.title}
                brand={p.brand}
                vendorName={p.vendor?.name}
                vendorSlug={p.vendor?.slug}
                tag={
                  (p.tag as
                    | "rollback"
                    | "clearance"
                    | "best"
                    | "popular"
                    | "new"
                    | null) ?? undefined
                }
                now={pesewasToPrice(p.pricePesewas)}
                was={
                  p.compareAtPesewas
                    ? pesewasToPrice(p.compareAtPesewas)
                    : undefined
                }
                rating={
                  p.ratingCount > 0 ? p.ratingAvgX100 / 100 : undefined
                }
                reviews={p.ratingCount > 0 ? p.ratingCount : undefined}
                stock={typeof p.stock === "number" ? p.stock : undefined}
                imageUrl={p.imageUrl}
                showAdd={
                  Boolean(p.offerId || p.variantId) && p.isPriceAvailable !== false
                }
                showShipping
                shippingLabel="Delivery options at checkout"
                onAdd={() => {
                  if (!p.offerId && !p.variantId) return
                  addCartItem.mutate({
                    data: {
                      offerId: p.offerId,
                      variantId: p.variantId,
                      qty: 1,
                    },
                  })
                }}
                addPending={addCartItem.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </ShopPage>
  )
}
