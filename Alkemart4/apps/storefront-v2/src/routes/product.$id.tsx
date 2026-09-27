import { useEffect, useMemo, useRef, useState } from "react"
import { BuyerProtection } from "@/components/commerce/buyer-protection"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DeliveryTruck01Icon,
  Share01Icon,
  ShoppingCart01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Gallery } from "@/components/product/gallery"
import { ProductDetails } from "@/components/product/specs"
import { Reviews } from "@/components/product/reviews"
import { SellerPanel } from "@/components/product/seller-panel"
import { ProductQuestions } from "@/components/product/questions"
import { NotifyMe } from "@/components/product/notify-me"
import { OptionPicker } from "@/components/commerce/option-picker"
import { OfferList } from "@/components/commerce/offer-list"
import { COMPARE_ENABLED } from "@/lib/features"
import { Price } from "@/components/commerce/price"
import { Rating } from "@/components/commerce/rating"
import { QtyStepper } from "@/components/commerce/qty-stepper"
import { SaveButton } from "@/components/commerce/save-button"
import { ProductRail } from "@/components/commerce/product-grid"
import { SectionHeader } from "@/components/commerce/section-header"
import { RecentlyViewed } from "@/components/commerce/recently-viewed"
import { ErrorState, EmptyState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useOfferSelection } from "@/hooks/use-offer-selection"
import { useCategories, qk } from "@/hooks/use-store"
import { useSlowLoad } from "@/hooks/use-slow-load"
import { addOfferToCart } from "@/lib/cart"
import {
  getStoreProduct,
  listRelatedProducts,
  listSimilarAlternatives,
  productParam,
  type PeerSort,
} from "@/lib/products"
import { getStoreVendorBySlug } from "@/lib/vendors"
import { formatMoney, useMarket } from "@/lib/market"
import { rememberRecentlyViewed } from "@/lib/recently-viewed"
import { trackAlternativeSelected, trackComparisonOpened, trackProductAdded, trackProductViewed } from "@/lib/analytics"
import { breadcrumbJsonLd, productJsonLd, stripHtml, truncateMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/product/$id")({
  validateSearch: (s: Record<string, unknown>): { offer?: string } =>
    typeof s.offer === "string" && s.offer ? { offer: s.offer } : {},
  component: ProductPage,
})

const SORTS: [PeerSort, string][] = [
  ["total", "Total"],
  ["price", "Price"],
  ["delivery", "Delivery"],
  ["trust", "Seller rating"],
]

function ProductPage() {
  const { id } = Route.useParams()
  const { offer: offerParam } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const market = useMarket()
  const [qty, setQty] = useState(1)
  const [sort, setSort] = useState<PeerSort>("total")

  const productQ = useQuery({ queryKey: qk.product(id), queryFn: () => getStoreProduct(id) })
  const p = productQ.data
  const slow = useSlowLoad(productQ.isLoading)
  // `?offer=` (homepage "Choose") preselects that seller once peers load.
  const { selection, peersQ, selectOption, selectOffer } = useOfferSelection(p, sort, offerParam)

  // Fire once per product, not on every refetch.
  const viewed = useRef<string | null>(null)
  useEffect(() => {
    if (!p || viewed.current === p.id) return
    viewed.current = p.id
    rememberRecentlyViewed(p.id)
    trackProductViewed({
      productId: p.id,
      name: p.title,
      price: p.amount ?? null,
      currency: p.currencyCode ?? null,
      sellerId: p.seller?.id ?? null,
    })
  }, [p])

  const compared = useRef<string | null>(null)
  const offerCount = peersQ.data?.offers.length
  useEffect(() => {
    const key = `${p?.id}:${sort}`
    if (!p?.id || offerCount == null || compared.current === key) return
    compared.current = key
    trackComparisonOpened({ productId: p.id, offerCount })
  }, [p?.id, sort, offerCount])

  const categoriesQ = useCategories()
  const crumbs = useMemo(() => {
    const list = categoriesQ.data ?? []
    const handle = p?.categoryHandles?.[0]?.toLowerCase()
    const byId = new Map(list.map((c) => [c.id, c]))
    let node = list.find((c) => (c.handle ?? "").toLowerCase() === handle)
    const chain: { name: string; slug: string }[] = []
    const seen = new Set<string>()
    while (node && !seen.has(node.id)) {
      seen.add(node.id)
      chain.unshift({ name: node.name, slug: node.handle ?? node.id })
      node = node.parentCategoryId ? byId.get(node.parentCategoryId) : undefined
    }
    if (!chain.length && p?.categoryLabel && handle) chain.push({ name: p.categoryLabel, slug: handle })
    return chain
  }, [categoriesQ.data, p])

  const sellerHandle = selection?.displaySeller?.handle ?? p?.seller?.handle ?? null
  const vendorQ = useQuery({
    queryKey: ["store", "vendor", sellerHandle],
    queryFn: () => getStoreVendorBySlug(sellerHandle!),
    enabled: Boolean(sellerHandle),
    staleTime: 60_000,
  })
  const paused = vendorQ.data?.vendor.availability?.state === "paused"

  const similarQ = useQuery({
    queryKey: ["store", "similar", p?.id],
    queryFn: () => listSimilarAlternatives(p!.id, 12),
    enabled: Boolean(p?.id),
  })
  const moreFromSellerQ = useQuery({
    queryKey: ["store", "related", p?.id, p?.seller?.id],
    queryFn: () =>
      listRelatedProducts({ excludeProductId: p!.id, sellerId: p?.seller?.id, sellerName: p?.seller?.name, limit: 12 }),
    enabled: Boolean(p?.id),
  })

  const canBuy = Boolean(selection?.canBuy) && !paused
  const reason = paused ? "This shop is paused" : selection?.blockedReason

  const buy = useMutation({
    mutationFn: async (mode: "cart" | "now") => {
      if (!selection?.activeOfferId) throw new Error(reason ?? "Not available to buy yet")
      const cart = await addOfferToCart(selection.activeOfferId, qty)
      return { cart, mode }
    },
    onSuccess: ({ cart, mode }) => {
      queryClient.setQueryData(qk.cart, cart)
      trackProductAdded({
        productId: p?.id,
        offerId: selection!.activeOfferId!,
        quantity: qty,
        price: selection?.displayAmount,
        currency: selection?.displayCurrency,
      })
      if (mode === "now") void navigate({ to: "/checkout" })
      else toast.success("Added to cart", { action: { label: "View cart", onClick: () => void navigate({ to: "/cart" }) } })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't add to cart"),
  })

  const path = p ? `/product/${productParam(p)}` : `/product/${id}`

  if (productQ.isError) {
    const notFound = (productQ.error as { status?: number })?.status === 404
    return (
      <div className="container-page py-10">
        <PageSeo title="Item unavailable" path={path} noindex />
        {notFound ? (
          <EmptyState
            title="This item is no longer listed"
            description="The seller may have removed it. Similar items are a search away."
            action={{ label: "Browse all products", to: "/categories/$slug", params: { slug: "all" } }}
          />
        ) : (
          <ErrorState title="This product didn't load" error={productQ.error} onRetry={() => void productQ.refetch()} />
        )}
      </div>
    )
  }

  if (!p) {
    return slow ? <PdpSkeleton /> : <div className="min-h-[70vh]" />
  }

  const images = (() => {
    const base = (p.images ?? []).map((i) => i.url)
    // Picked variant art leads the gallery.
    const picked = (selection?.options ?? [])
      .flatMap((o) => o.values.filter((v) => v.selected && v.imageUrl).map((v) => v.imageUrl!))
    return [...new Set([...picked, ...base, ...(p.webUrl ? [p.webUrl] : []), ...(p.thumbnail ? [p.thumbnail] : [])])]
  })()

  const offers = peersQ.data?.offers ?? []
  const showOffers = p.identity?.comparisonEligible !== false && (selection?.candidates.length ?? 0) > 1
  const seller = selection?.displaySeller
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      productJsonLd({
        id: p.id,
        title: p.title,
        description: p.description,
        handle: p.handle,
        thumbnail: p.thumbnail,
        path,
        brandName: p.identity?.brand ?? null,
        offers: offers
          .filter((o) => o.amount != null && o.currencyCode)
          .map((o) => ({
            price: o.amount as number,
            currencyCode: o.currencyCode as string,
            sellerName: o.seller.name ?? "Seller",
            inStock: true as const,
            deliveryFee: o.deliveryAmount ?? null,
          })),
        variants: null,
        rating: p.ratingAvg != null && (p.ratingCount ?? 0) > 0 ? { avg: p.ratingAvg, count: p.ratingCount ?? 0 } : null,
      }),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        ...crumbs.map((c) => ({ name: c.name, path: `/categories/${c.slug}` })),
        { name: p.title, path },
      ]),
    ],
  }

  return (
    <div className="pb-28 lg:pb-0">
      <PageSeo
        title={p.title}
        description={p.description ? truncateMeta(stripHtml(p.description)) : `${p.title} on alkemart`}
        path={path}
        image={p.thumbnail}
        type="product"
        jsonLd={jsonLd}
      />

      <div className="container-page space-y-8 pt-3 sm:space-y-12 sm:pt-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.map((c) => (
              <span key={c.slug} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/categories/$slug" params={{ slug: c.slug }}>
                      {c.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </span>
            ))}
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
              <BreadcrumbPage className="truncate">{p.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <article className="grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Gallery key={images.join("|")} images={images} title={p.title} />
          </div>

          <div className="space-y-5">
            <header className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {p.identity?.brand ? (
                    <Link
                      to="/search"
                      search={{ q: p.identity.brand }}
                      className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {p.identity.brand}
                    </Link>
                  ) : null}
                  <h1 className="text-2xl leading-tight font-extrabold sm:text-3xl">{p.title}</h1>
                </div>
                <div className="flex shrink-0 gap-2">
                  <SaveButton product={p} variant="inline" />
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label="Share"
                    onClick={async () => {
                      const url = window.location.href
                      try {
                        if (navigator.share) await navigator.share({ title: p.title, url })
                        else {
                          await navigator.clipboard.writeText(url)
                          toast("Link copied")
                        }
                      } catch {
                        /* dismissed */
                      }
                    }}
                  >
                    <HugeiconsIcon icon={Share01Icon} />
                  </Button>
                </div>
              </div>
              {p.ratingCount ? (
                <a href="#reviews" className="inline-block">
                  <Rating avg={p.ratingAvg} count={p.ratingCount} />
                </a>
              ) : null}
            </header>

            <div className="space-y-1">
              <Price
                amount={selection?.displayAmount}
                currency={selection?.displayCurrency}
                size="xl"
                from={Boolean(selection?.requiresOfferPick && !selection.activeOfferId)}
                compareAt={(() => {
                  const hist = selection?.activeOfferId ? peersQ.data?.priceHistory[selection.activeOfferId] : undefined
                  return hist?.[0]?.oldAmount ?? null
                })()}
              />
              {seller?.name ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    Sold by{" "}
                    {seller.handle ? (
                      <Link to="/shops/$slug" params={{ slug: seller.handle }} className="font-semibold text-foreground hover:underline">
                        {seller.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{seller.name}</span>
                    )}
                  </span>
                  {COMPARE_ENABLED && showOffers && selection?.autoPicked ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-foreground">Best price</span>
                  ) : null}
                  {showOffers ? (
                    <a href="#sellers" className="inline-flex min-h-6 items-center font-semibold text-foreground underline underline-offset-4">
                      {COMPARE_ENABLED ? `Compare ${selection!.candidates.length} sellers` : `${selection!.candidates.length} shops sell this`}
                    </a>
                  ) : null}
                </p>
              ) : null}
            </div>

            <ul className="flex flex-wrap gap-2 text-xs font-medium">
              {market.paymentMethods.includes("cod") ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5">
                  <HugeiconsIcon icon={Wallet01Icon} className="size-4" /> Pay on delivery available
                </li>
              ) : null}
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5">
                <HugeiconsIcon icon={DeliveryTruck01Icon} className="size-4" />
                {selection?.activeOffer?.deliveryAmount != null
                  ? selection.activeOffer.deliveryAmount === 0
                    ? "Free delivery"
                    : `Delivery from this seller: ${formatMoney(selection.activeOffer.deliveryAmount, selection.activeOffer.currencyCode)}`
                  : "Delivery fee shown before you pay"}
              </li>
            </ul>

            {selection?.hasMatrix ? <OptionPicker options={selection.options} onSelect={selectOption} /> : null}

            {selection?.outOfStock ? (
              <NotifyMe productId={p.id} offerId={selection.activeOfferId} path={path} />
            ) : null}

            <div className="hidden space-y-3 lg:block">
              <BuyControls
                qty={qty}
                setQty={setQty}
                canBuy={canBuy}
                pending={buy.isPending}
                onAdd={() => buy.mutate("cart")}
                onBuy={() => buy.mutate("now")}
              />
              {reason ? <p className="text-sm font-medium text-muted-foreground">{reason}</p> : null}
            </div>


            {vendorQ.data ? <SellerPanel vendor={vendorQ.data.vendor} productId={p.id} productTitle={p.title} /> : null}
          </div>
        </article>

        {showOffers ? (
          <section id="sellers" aria-labelledby="sellers-title" className="scroll-mt-24">
            <SectionHeader
              id="sellers-title"
              title={`Available from ${selection!.candidates.length} sellers`}
              subtitle={COMPARE_ENABLED ? "Same item, different shops. Compare price and delivery, then choose." : "Choose the shop you want to buy from."}
            >
              {COMPARE_ENABLED ? (
              <div className="hidden items-center gap-1 rounded-full bg-surface p-1 sm:flex" role="group" aria-label="Sort sellers">
                {SORTS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold",
                      sort === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              ) : null}
            </SectionHeader>
            <OfferList
              offers={selection!.candidates}
              activeOfferId={selection!.activeOfferId}
              onChoose={selectOffer}
              explanation={peersQ.data?.explanation}
            />
          </section>
        ) : null}

        <section aria-label="Details">
          <ProductDetails product={p} />
        </section>

        <section id="questions" aria-labelledby="questions-title" className="scroll-mt-24">
          <SectionHeader id="questions-title" title="Questions" />
          <ProductQuestions productId={p.id} sellerId={vendorQ.data?.vendor.id ?? null} sellerName={vendorQ.data?.vendor.name ?? null} />
        </section>

        <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-24">
          <SectionHeader id="reviews-title" title="Reviews" />
          <Reviews product={p} />
        </section>
      </div>

      <div className="mt-12 space-y-12">
        {(similarQ.data?.length ?? 0) > 0 ? (
          <section
            className="container-page"
            aria-label="Similar items"
            onClickCapture={(e) => {
              const a = e.target instanceof Element ? e.target.closest("a[href*='/product/']") : null
              if (a) trackAlternativeSelected({ productId: p.id, alternativeId: a.getAttribute("href") ?? "", source: "similar" })
            }}
          >
            <SectionHeader title="Similar items" />
            <ProductRail products={similarQ.data!} label="Similar items" />
          </section>
        ) : null}
        {moreFromSellerQ.data?.mode === "seller" && moreFromSellerQ.data.products.length > 0 ? (
          <section className="container-page" aria-label="More from this seller">
            <SectionHeader
              title={`More from ${p.seller?.name ?? "this seller"}`}
              action={p.seller?.handle ? { label: "Visit store", to: "/shops/$slug", params: { slug: p.seller.handle } } : undefined}
            />
            <ProductRail products={moreFromSellerQ.data.products} label="More from this seller" />
          </section>
        ) : null}
        <RecentlyViewed excludeId={p.id} />
      </div>

      {/* Phone buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-safe backdrop-blur lg:hidden">
        {reason ? <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{reason}</p> : null}
        {selection?.requiresOfferPick && !selection.activeOfferId && showOffers ? (
          <Button
            size="xl"
            className="w-full"
            onClick={() => document.getElementById("sellers")?.scrollIntoView({ behavior: "smooth" })}
          >
            Choose a seller
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xl"
              className="flex-1"
              disabled={!canBuy || buy.isPending}
              onClick={() => buy.mutate("cart")}
            >
              <HugeiconsIcon icon={ShoppingCart01Icon} data-icon="inline-start" />
              Add to cart
            </Button>
            <Button variant="brand" size="xl" className="flex-1" disabled={!canBuy || buy.isPending} onClick={() => buy.mutate("now")}>
              Buy now
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function BuyControls({
  qty,
  setQty,
  canBuy,
  pending,
  onAdd,
  onBuy,
}: {
  qty: number
  setQty: (n: number) => void
  canBuy: boolean
  pending: boolean
  onAdd: () => void
  onBuy: () => void
}) {
  return (
    <div className="space-y-3">
    <div className="flex items-center gap-3">
      <QtyStepper value={qty} onChange={setQty} disabled={!canBuy} />
      <Button variant="outline" size="xl" className="flex-1" disabled={!canBuy || pending} onClick={onAdd}>
        <HugeiconsIcon icon={ShoppingCart01Icon} data-icon="inline-start" />
        Add to cart
      </Button>
      <Button variant="brand" size="xl" className="flex-1" disabled={!canBuy || pending} onClick={onBuy}>
        Buy now
      </Button>
    </div>
    <BuyerProtection />
    </div>
  )
}

function PdpSkeleton() {
  return (
    <div className="container-page grid gap-10 pt-8 lg:grid-cols-[1.05fr_1fr]" aria-busy>
      <Skeleton className="aspect-square rounded-[2rem]" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    </div>
  )
}
