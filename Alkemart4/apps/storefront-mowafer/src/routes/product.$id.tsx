import { useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Breadcrumbs, MerchEmpty, Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui"
import { toast } from "sonner"
import { ProductGallery } from "@/components/product/ProductGallery"
import { BuyPanel } from "@/components/product/BuyPanel"
import { PeerOffersList } from "@/components/product/PeerOffersList"
import { StickyBuyBar } from "@/components/product/StickyBuyBar"
import { addOfferToCart } from "@/lib/cart"
import { getStoreProduct, listPeerOffersForProduct } from "@/lib/products"
import { formatRating } from "@/lib/product-rating"

export const Route = createFileRoute("/product/$id")({
  component: ProductDetailPage,
})

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

  const peersQ = useQuery({
    queryKey: ["store", "peer-offers", p?.id],
    queryFn: () => listPeerOffersForProduct(p!.id),
    enabled: Boolean(p?.id),
  })

  const peerOffers = peersQ.data ?? []
  const offerCount = p?.offerCount ?? peerOffers.length
  const showPeers = offerCount > 1 && peerOffers.length > 1
  const activeOfferId =
    selectedOfferId || p?.offerId || peerOffers[0]?.offerId || null
  const activePeer = peerOffers.find((o) => o.offerId === activeOfferId)
  const amount = activePeer?.amount ?? p?.amount
  const currency = activePeer?.currencyCode ?? p?.currencyCode
  const sellerName = activePeer?.seller.name ?? p?.seller?.name
  const sellerHandle = activePeer?.seller.handle ?? p?.seller?.handle
  const canAdd = Boolean(activeOfferId)

  const add = useMutation({
    mutationFn: () => addOfferToCart(activeOfferId!, qty),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
      toast.success(`${qty} item${qty === 1 ? "" : "s"} added to cart`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not add to cart")
    },
  })

  const specs = p?.attributes ?? []
  const reviews = p?.reviews ?? []
  const ratingLabel = p ? formatRating(p.ratingAvg ?? 0, p.ratingCount ?? 0) : null
  const showSpecs = specs.length > 0
  const showReviews = reviews.length > 0
  const defaultTab = showSpecs ? "specs" : showReviews ? "reviews" : undefined

  const images = useMemo(() => p?.images ?? (p?.thumbnail ? [{ url: p.thumbnail }] : []), [p])

  if (productQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading product…</p>
  }
  if (productQ.isError || !p) {
    return (
      <MerchEmpty
        title="Product not found"
        body="This listing is missing from the catalog."
        action={
          <Link to="/" className="text-sm font-semibold underline">
            Back home
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          p.categoryLabel
            ? {
                label: p.categoryLabel,
                href: `/categories/${p.categoryHandles?.[0] ?? "all"}`,
              }
            : { label: "Products", href: "/categories/all" },
          { label: p.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <ProductGallery images={images} title={p.title} />
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold tracking-tight">{p.title}</h1>
          {ratingLabel ? <p className="text-sm text-muted-foreground">{ratingLabel} reviews</p> : null}
          <BuyPanel
            amount={amount}
            currencyCode={currency}
            quantity={qty}
            onQuantityChange={setQty}
            canAdd={canAdd}
            pending={add.isPending}
            sellerName={sellerName}
            sellerHandle={sellerHandle}
            onAdd={() => add.mutate()}
          />
          {showSpecs || showReviews ? (
            <Tabs defaultValue={defaultTab}>
              <TabsList>
                {showSpecs ? <TabsTrigger value="specs">Specs</TabsTrigger> : null}
                {showReviews ? <TabsTrigger value="reviews">Reviews</TabsTrigger> : null}
              </TabsList>
              {showSpecs ? (
                <TabsContent value="specs" className="space-y-2 pt-3">
                  <dl className="grid gap-2 text-sm">
                    {specs.map((a) => (
                      <div key={a.label} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{a.label}</dt>
                        <dd className="font-medium">{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                </TabsContent>
              ) : null}
              {showReviews ? (
                <TabsContent value="reviews" className="space-y-3 pt-3">
                  {reviews.map((r, i) => (
                    <article key={i} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-semibold">
                        {r.rating} out of 5{r.title ? ` · ${r.title}` : ""}
                      </p>
                      <p className="mt-1 text-muted-foreground">{r.body}</p>
                    </article>
                  ))}
                </TabsContent>
              ) : null}
            </Tabs>
          ) : null}
        </div>
      </div>

      {showPeers ? (
        <PeerOffersList
          offers={peerOffers}
          activeOfferId={activeOfferId}
          onSelect={setSelectedOfferId}
        />
      ) : null}

      <StickyBuyBar
        amount={amount}
        currencyCode={currency}
        canAdd={canAdd}
        pending={add.isPending}
        onAdd={() => add.mutate()}
      />
    </div>
  )
}
