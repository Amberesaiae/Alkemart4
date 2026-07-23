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
import { PeerOffersList } from "@/components/product/PeerOffersList"
import { ProductBuyPanel } from "@/components/product/ProductBuyPanel"
import { SectionHeader } from "@/components/shell/SectionHeader"
import { Breadcrumbs } from "@/components/shell/Breadcrumbs"
import { addOfferToCart } from "@/lib/cart"
import {
  getStoreProduct,
  listPeerOffersForProduct,
  listRelatedProducts,
} from "@/lib/products"
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

/**
 * PDP composition — gallery · info · buy panel · peer offers · related.
 */
function ProductDetailPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [qty, setQty] = useState(1)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)

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
    if (p.offerId) setSelectedOfferId(p.offerId)
  }, [p?.id, p?.offerId])

  const peersQ = useQuery({
    queryKey: ["store", "peer-offers", p?.id],
    queryFn: () => listPeerOffersForProduct(p!.id),
    enabled: Boolean(p?.id),
  })

  const relatedQ = useQuery({
    queryKey: ["store", "related", p?.id, p?.seller?.id, p?.seller?.name],
    queryFn: () =>
      listRelatedProducts({
        excludeProductId: p!.id,
        sellerId: p?.seller?.id,
        sellerName: p?.seller?.name,
        limit: 6,
      }),
    enabled: Boolean(p?.id),
  })

  const activeOfferId = selectedOfferId || p?.offerId || null
  const peerOffers = peersQ.data ?? []
  const activePeer = peerOffers.find((o) => o.offerId === activeOfferId)
  const displayAmount = activePeer?.amount ?? p?.amount ?? null
  const displayCurrency = activePeer?.currencyCode ?? p?.currencyCode ?? null
  const displaySeller = activePeer?.seller ?? p?.seller ?? null

  const add = useMutation({
    mutationFn: async () => {
      if (!activeOfferId) throw new Error("This item is not available to buy yet")
      return addOfferToCart(activeOfferId, qty)
    },
    onSuccess: () => {
      if (activeOfferId) {
        trackProductAdded({
          productId: p?.id,
          offerId: activeOfferId,
          quantity: qty,
          price: displayAmount,
          currency: displayCurrency,
        })
      }
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
    },
  })

  const canAdd = Boolean(activeOfferId)
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
            amount: displayAmount,
            currencyCode: displayCurrency,
            path: productPath,
            sellerName: displaySeller?.name,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Browse", path: "/categories/all" },
            ...(displaySeller?.handle
              ? [
                  {
                    name: displaySeller.name ?? "Seller",
                    path: `/shops/${displaySeller.handle}`,
                  },
                ]
              : []),
            { name: p.title, path: productPath },
          ]),
        ],
      }
    : null

  return (
    <div className="space-y-10 pb-8">
      {p ? (
        <PageSeo
          title={p.title}
          description={
            p.description
              ? truncateMeta(stripHtml(p.description))
              : displaySeller?.name
                ? `${p.title} from ${displaySeller.name} on alkemart`
                : `${p.title} on alkemart`
          }
          path={productPath}
          image={p.thumbnail}
          type="product"
          jsonLd={jsonLd}
        />
      ) : null}

      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Browse", to: "/categories/$slug", params: { slug: "all" } },
          ...(displaySeller?.handle
            ? [
                {
                  label: displaySeller.name ?? "Seller",
                  to: "/shops/$slug",
                  params: { slug: displaySeller.handle },
                },
              ]
            : []),
          { label: p?.title ?? "Product" },
        ]}
      />

      {productQ.isLoading ? (
        <div
          className="grid gap-6 lg:grid-cols-12"
          role="status"
          aria-label="Loading product"
        >
          <Skeleton className="aspect-square w-full rounded-2xl lg:col-span-5" />
          <div className="space-y-3 lg:col-span-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl lg:col-span-3" />
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
        <article className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-white lg:col-span-5">
            {p.thumbnail ? (
              <img
                src={p.thumbnail}
                alt={p.title || "Product image"}
                className="aspect-square w-full object-contain p-4"
              />
            ) : (
              <div
                className="flex aspect-square flex-col items-center justify-center gap-2 bg-primary/15"
                aria-hidden
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
                  {(p.title || "A").trim().charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:col-span-4">
            <header className="space-y-2 border-b border-border pb-4">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {p.title}
              </h1>
              {displaySeller ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <SellerChip seller={displaySeller} className="text-sm" />
                </div>
              ) : null}
            </header>

            <Price
              amount={displayAmount}
              currencyCode={displayCurrency}
              size="lg"
              className="text-2xl font-bold"
            />

            <PeerOffersList
              offers={peerOffers}
              activeOfferId={activeOfferId}
              onSelect={setSelectedOfferId}
            />

            {p.description ? (
              <div className="space-y-2">
                <h2 className="text-sm font-bold">About this item</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description from the seller yet.
              </p>
            )}
          </div>

          <div className="hidden lg:col-span-3 lg:block">
            <ProductBuyPanel
              sticky
              amount={displayAmount}
              currencyCode={displayCurrency}
              quantity={qty}
              onQuantityChange={setQty}
              canAdd={canAdd}
              pending={add.isPending}
              success={add.isSuccess}
              errorMessage={
                add.isError
                  ? add.error instanceof Error
                    ? add.error.message
                    : "Add failed"
                  : null
              }
              onAdd={() => add.mutate()}
              sellerName={displaySeller?.name}
              sellerHandle={displaySeller?.handle}
            />
          </div>
        </article>
      ) : null}

      {p ? (
        <div className="lg:hidden">
          <ProductBuyPanel
            amount={displayAmount}
            currencyCode={displayCurrency}
            quantity={qty}
            onQuantityChange={setQty}
            canAdd={canAdd}
            pending={add.isPending}
            success={add.isSuccess}
            errorMessage={
              add.isError
                ? add.error instanceof Error
                  ? add.error.message
                  : "Add failed"
                : null
            }
            onAdd={() => add.mutate()}
            sellerName={displaySeller?.name}
            sellerHandle={displaySeller?.handle}
          />
        </div>
      ) : null}

      {p ? (
        <section className="space-y-4 border-t border-border pt-8">
          <SectionHeader
            title={
              relatedQ.data?.mode === "seller" && displaySeller?.name
                ? `More from ${displaySeller.name}`
                : "You may also like"
            }
            actionLabel="Browse all"
            actionTo="/categories/$slug"
            actionParams={{ slug: "all" }}
          />
          {relatedQ.isLoading ? <ProductGridSkeleton count={4} /> : null}
          {relatedQ.data && relatedQ.data.products.length > 0 ? (
            <ProductGridShell>
              {relatedQ.data.products.map((rp) => (
                <ProductCard key={rp.id} product={rp} size="tile" />
              ))}
            </ProductGridShell>
          ) : null}
        </section>
      ) : null}

      {p ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3 md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <QtyStepper
              value={qty}
              onChange={setQty}
              disabled={!canAdd}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <Price
                amount={displayAmount}
                currencyCode={displayCurrency}
                size="sm"
              />
            </div>
            <Button
              type="button"
              size="lg"
              className="min-h-11 min-w-[7.5rem] shrink-0 rounded-full font-bold"
              disabled={!canAdd || add.isPending}
              onClick={() => add.mutate()}
            >
              {add.isPending ? "…" : "Add"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
