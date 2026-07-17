import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/price"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { SellerChip } from "@/components/seller-chip"
import { Skeleton, ProductGridSkeleton } from "@/components/skeleton"
import { QtyStepper } from "@/components/qty-stepper"
import { addOfferToCart } from "@/lib/cart"
import { getStoreProduct, listRelatedProducts } from "@/lib/products"
import {
  trackProductAdded,
  trackProductViewed,
} from "@/lib/analytics"
import { PageSeo } from "@/components/page-seo"
import {
  breadcrumbJsonLd,
  productJsonLd,
  stripHtml,
  truncateMeta,
} from "@/lib/seo"

export const Route = createFileRoute("/product/$id")({
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [qty, setQty] = useState(1)

  const productQ = useQuery({
    queryKey: ["store", "product", id],
    queryFn: () => getStoreProduct(id),
  })

  const p = productQ.data

  useEffect(() => {
    if (!p?.id) return
    trackProductViewed({
      productId: p.id,
      name: p.title,
      price: p.amount ?? null,
      currency: p.currencyCode ?? null,
      sellerId: p.seller?.id ?? null,
    })
  }, [p?.id])

  const relatedQ = useQuery({
    queryKey: [
      "store",
      "related",
      p?.id,
      p?.seller?.id,
      p?.seller?.name,
    ],
    queryFn: () =>
      listRelatedProducts({
        excludeProductId: p!.id,
        sellerId: p?.seller?.id,
        sellerName: p?.seller?.name,
        limit: 6,
      }),
    enabled: Boolean(p?.id),
  })

  const add = useMutation({
    mutationFn: async () => {
      const offerId = productQ.data?.offerId
      if (!offerId) throw new Error("No offer_id from store API")
      return addOfferToCart(offerId, qty)
    },
    onSuccess: () => {
      const offerId = productQ.data?.offerId
      if (offerId) {
        trackProductAdded({
          productId: productQ.data?.id,
          offerId,
          quantity: qty,
          price: productQ.data?.amount ?? null,
          currency: productQ.data?.currencyCode ?? null,
        })
      }
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
    },
  })

  const canAdd = Boolean(p?.offerId)

  const productPath = `/product/${id}`
  const jsonLd = p?.id
    ? {
        "@context": "https://schema.org",
        "@graph": [
          productJsonLd({
            id: p.id,
            title: p.title,
            description: p.description,
            handle: p.handle,
            thumbnail: p.thumbnail,
            amount: p.amount,
            currencyCode: p.currencyCode,
            path: productPath,
            sellerName: p.seller?.name,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Browse", path: "/browse/all" },
            ...(p.seller?.handle
              ? [
                  {
                    name: p.seller.name ?? "Seller",
                    path: `/store/${p.seller.handle}`,
                  },
                ]
              : []),
            { name: p.title, path: productPath },
          ]),
        ],
      }
    : null

  return (
    <div className="space-y-10 pb-28 md:pb-8">
      {p ? (
        <PageSeo
          title={p.title}
          description={
            p.description
              ? truncateMeta(stripHtml(p.description))
              : p.seller?.name
                ? `${p.title} from ${p.seller.name} on alkemart`
                : `${p.title} on alkemart`
          }
          path={productPath}
          image={p.thumbnail}
          type="product"
          jsonLd={jsonLd}
        />
      ) : null}
      <nav className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link
          to="/browse/$slug"
          params={{ slug: "all" }}
          className="hover:underline"
        >
          Browse
        </Link>
        {p?.seller?.handle ? (
          <>
            <span className="mx-1">/</span>
            <Link
              to="/store/$slug"
              params={{ slug: p.seller.handle }}
              className="hover:underline"
            >
              {p.seller.name ?? "Seller"}
            </Link>
          </>
        ) : null}
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground line-clamp-1">
          {p?.title ?? "Product"}
        </span>
      </nav>

      {productQ.isLoading ? (
        <div
          className="grid gap-8 md:grid-cols-2"
          role="status"
          aria-label="Loading product"
        >
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      ) : null}

      {productQ.isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm"
        >
          <p className="font-semibold text-destructive">Could not load product</p>
          <p className="text-muted-foreground">
            {productQ.error instanceof Error
              ? productQ.error.message
              : "Unknown error"}
          </p>
        </div>
      ) : null}

      {p ? (
        <article className="grid items-start gap-8 md:grid-cols-2 md:gap-10">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            {p.thumbnail ? (
              <img
                src={p.thumbnail}
                alt=""
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-sm text-muted-foreground">
                No image from store API
              </div>
            )}
          </div>

          <div className="space-y-5">
            <header className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {p.title}
              </h1>
              <SellerChip seller={p.seller} className="text-sm" />
              <Price
                amount={p.amount}
                currencyCode={p.currencyCode}
                size="lg"
                className="text-2xl"
              />
            </header>

            <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Delivery options and fees are confirmed at checkout from seller
              shipping configuration — not estimated here.
            </p>

            {p.description ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">About</h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {p.description}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description from API.
              </p>
            )}

            {!p.offerId ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                This product has no offer_id — cannot add to cart.
              </p>
            ) : null}

            <div className="hidden space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm md:block">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Quantity
                  </p>
                  <QtyStepper value={qty} onChange={setQty} disabled={!canAdd} />
                </div>
                <Price
                  amount={
                    p.amount != null ? p.amount * qty : null
                  }
                  currencyCode={p.currencyCode}
                  size="md"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="min-h-12 flex-1 rounded-xl"
                  disabled={!canAdd || add.isPending}
                  onClick={() => add.mutate()}
                >
                  {add.isPending
                    ? "Adding…"
                    : qty > 1
                      ? `Add ${qty} to cart`
                      : "Add to cart"}
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-12 rounded-xl"
                >
                  <Link to="/cart">View cart</Link>
                </Button>
              </div>
              {p.seller?.handle ? (
                <Button asChild variant="ghost" className="w-full rounded-xl">
                  <Link to="/store/$slug" params={{ slug: p.seller.handle }}>
                    Visit {p.seller.name ?? "seller"} store
                  </Link>
                </Button>
              ) : null}
              {add.isSuccess ? (
                <p className="text-sm font-medium" aria-live="polite">
                  Added to cart.{" "}
                  <Link to="/cart" className="underline">
                    View cart
                  </Link>
                </p>
              ) : null}
              {add.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {add.error instanceof Error
                    ? add.error.message
                    : "Add failed"}
                </p>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}

      {p ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              {relatedQ.data?.mode === "seller" && p.seller?.name
                ? `More from ${p.seller.name}`
                : "You may also like"}
            </h2>
            <Link
              to="/browse/$slug"
              params={{ slug: "all" }}
              className="text-sm font-semibold underline-offset-4 hover:underline"
            >
              Browse all
            </Link>
          </div>
          {relatedQ.isLoading ? <ProductGridSkeleton count={4} /> : null}
          {relatedQ.data && relatedQ.data.products.length > 0 ? (
            <ProductGridShell>
              {relatedQ.data.products.map((rp) => (
                <ProductCard key={rp.id} product={rp} />
              ))}
            </ProductGridShell>
          ) : null}
          {relatedQ.data && relatedQ.data.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other products in the catalog response yet.
            </p>
          ) : null}
        </section>
      ) : null}

      {p ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <QtyStepper
              value={qty}
              onChange={setQty}
              disabled={!canAdd}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <Price amount={p.amount} currencyCode={p.currencyCode} size="sm" />
            </div>
            <Button
              type="button"
              size="lg"
              className="min-h-11 min-w-[7.5rem] shrink-0 rounded-xl"
              disabled={!canAdd || add.isPending}
              onClick={() => add.mutate()}
            >
              {add.isPending ? "…" : "Add"}
            </Button>
          </div>
          {add.isSuccess ? (
            <p
              className="mx-auto mt-1 max-w-6xl text-center text-xs"
              aria-live="polite"
            >
              Added.{" "}
              <Link to="/cart" className="font-semibold underline">
                Cart
              </Link>
            </p>
          ) : null}
          {add.isError ? (
            <p className="mx-auto mt-1 max-w-6xl text-center text-xs text-destructive">
              {add.error instanceof Error ? add.error.message : "Add failed"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
