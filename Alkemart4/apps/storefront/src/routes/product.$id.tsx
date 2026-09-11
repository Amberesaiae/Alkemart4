import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui"
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
import { BottomBar } from "@/components/bottom-bar"
import { ErrorAlert } from "@/components/error-alert"
import { ProductImageGallery } from "@/components/product/ProductImageGallery"
import { addOfferToCart } from "@/lib/cart"
import {
  getStoreProduct,
  listPeerOffersForProduct,
  listRelatedProducts,
} from "@/lib/products"
import { getStoreVendorBySlug } from "@/lib/vendors"
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

  const peerOffers = peersQ.data ?? []
  const peersReady = peersQ.isSuccess || peersQ.isError
  // Prefer product.offerCount (CF detail) so we don't auto-select during peer load.
  /** V1 matrix: attribute-first selection resolving to combo offers. */
  const optionTypes = p?.optionTypes ?? []
  const allCombos = p?.combos ?? []
  const hasMatrix = optionTypes.length > 0
  const [comboSel, setComboSel] = useState<Record<string, string>>({})
  const peerIdSet = useMemo(() => new Set(peerOffers.map((o) => o.offerId)), [peerOffers])
  const comboMatches = (combo: { options: Record<string, string> }, sel: Record<string, string>) =>
    Object.entries(sel).every(([k, v]) => (combo.options[k] ?? "").toLowerCase() === v.toLowerCase())
  const matchingCombos = useMemo(
    () => allCombos.filter((c) => comboMatches(c, comboSel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCombos, comboSel],
  )
  const comboComplete =
    !hasMatrix ||
    optionTypes.every(
      (t) => comboSel[t.name] && t.values.some((v) => v.toLowerCase() === comboSel[t.name].toLowerCase()),
    )
  const comboBuyable = (c: { active: boolean; availableQty: number; offerId: string }) =>
    c.active && c.availableQty > 0 && peerIdSet.has(c.offerId)
  const exactBuyable = comboComplete ? matchingCombos.filter(comboBuyable) : []
  // Preselect the cheapest buyable combo once peers resolve (anchors lowest price).
  useEffect(() => {
    if (!hasMatrix || !peersReady || Object.keys(comboSel).length > 0) return
    const finite = allCombos.filter((c) => comboBuyable(c) && c.amount != null)
    finite.sort((a, b) => (a.amount as number) - (b.amount as number))
    const first = finite[0]
    if (!first) return
    const sel: Record<string, string> = {}
    for (const t of optionTypes) {
      const v = first.options[t.name]
      if (v) sel[t.name] = v
    }
    setComboSel(sel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMatrix, peersReady, p?.id])
  // A stale seller pick must never survive a combination change.
  useEffect(() => {
    if (hasMatrix) setSelectedOfferId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comboSel])
  const knownOfferCount = p?.offerCount ?? (peersReady ? peerOffers.length : null)
  const matchingBuyableIds = useMemo(
    () => new Set(matchingCombos.filter(comboBuyable).map((c) => c.offerId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchingCombos, peerIdSet],
  )
  const matrixPeers = useMemo(
    () => (hasMatrix ? peerOffers.filter((o) => matchingBuyableIds.has(o.offerId)) : peerOffers),
    [hasMatrix, peerOffers, matchingBuyableIds],
  )
  const requiresOfferPick = hasMatrix
    ? matrixPeers.length > 1
    : (knownOfferCount ?? 0) > 1
  const activeOfferId = requiresOfferPick
    ? selectedOfferId
    : selectedOfferId || (hasMatrix ? (matrixPeers[0]?.offerId ?? null) : (p?.offerId || peerOffers[0]?.offerId || null))
  const activePeer = peerOffers.find((o) => o.offerId === activeOfferId)
  const matrixAmount = hasMatrix && comboComplete
    ? matchingCombos.reduce<number | null>(
        (best, c) => (c.amount != null && (best == null || c.amount < best) ? c.amount : best),
        null,
      )
    : null
  const displayAmount = matrixAmount ?? activePeer?.amount ?? p?.amount ?? null
  const displayCurrency = activePeer?.currencyCode ?? p?.currencyCode ?? null
  const displaySeller = activePeer?.seller ?? p?.seller ?? null
  const matrixOk = !hasMatrix || (comboComplete && exactBuyable.length > 0)
  const matrixReason = !hasMatrix
    ? null
    : !comboComplete
      ? "Select " + (optionTypes.find((t) => !comboSel[t.name])?.name ?? "options")
      : exactBuyable.length === 0
        ? (matchingCombos.length > 0 && matchingCombos.every((c) => !c.active)
          ? "This combination is no longer available"
          : "This combination is out of stock")
        : null

  useEffect(() => {
    // Matrix products resolve through the combination selector instead.
    if (hasMatrix) return
    // Wait until we know offer count; never auto-pick when multiple sellers.
    if (!peersReady && p?.offerCount == null) return
    if (requiresOfferPick) return
    if (!selectedOfferId && (p?.offerId || peerOffers[0]?.offerId)) {
      setSelectedOfferId(p?.offerId || peerOffers[0]?.offerId || null)
    }
  }, [peersReady, requiresOfferPick, p?.offerId, p?.offerCount, peerOffers, selectedOfferId])

  // Reset selection when navigating to a different product.
  useEffect(() => {
    setSelectedOfferId(null)
    setComboSel({})
  }, [p?.id])

  const add = useMutation({
    mutationFn: async () => {
      if (!activeOfferId) {
        throw new Error(
          requiresOfferPick
            ? "Select a seller offer before adding to cart"
            : "This item is not available to buy yet",
        )
      }
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

  const canAddBase = Boolean(activeOfferId) && (!requiresOfferPick || Boolean(selectedOfferId))

  /** Paused sellers keep listings visible but block checkout server-side —
      the buy panel mirrors that with a disabled CTA + reason. */
  const pauseQ = useQuery({
    queryKey: ["store", "vendor-pause", displaySeller?.handle],
    queryFn: () => getStoreVendorBySlug(displaySeller!.handle as string),
    enabled: Boolean(displaySeller?.handle),
    staleTime: 60_000,
  })
  const pauseInfo = pauseQ.data?.vendor.availability
  const sellerPaused = pauseInfo?.state === "paused"
  const canAdd = canAddBase && !sellerPaused && matrixOk
  const pausedReason = sellerPaused
    ? `This shop is paused${pauseInfo?.note ? ` — ${pauseInfo.note}` : ""}${pauseInfo?.pausedUntil ? ` (back ${new Date(pauseInfo.pausedUntil).toLocaleDateString()})` : ""}`
    : null
  const unavailableReason = pausedReason ?? matrixReason
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
        <ErrorAlert
          message={productQ.error instanceof Error ? productQ.error.message : "Could not load product"}
        />
      ) : null}

      {p ? (
        <article className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <ProductImageGallery
              images={p.images}
              webUrl={p.webUrl}
              thumbUrl={p.thumbUrl}
              title={p.title}
              categoryLabel={p.categoryLabel}
              categoryHandle={p.categoryHandles?.[0] ?? null}
            />
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

            {hasMatrix && (
              <div className="space-y-3">
                {optionTypes.map((t) => (
                  <div key={t.name} className="space-y-1.5">
                    <p className="text-sm font-bold" id={"combo-label-" + t.name}>
                      {t.name}:{" "}
                      <span className="font-medium text-muted-foreground">
                        {comboSel[t.name] ?? "Select"}
                      </span>
                    </p>
                    <div role="radiogroup" aria-labelledby={"combo-label-" + t.name} className="flex flex-wrap gap-2">
                      {t.values.map((v) => {
                        const chosen: Record<string, string> = { ...comboSel, [t.name]: v }
                        const exists = allCombos.some((c) => comboMatches(c, chosen))
                        if (!exists) return null
                        const buyable = allCombos.some(
                          (c) => comboMatches(c, chosen) && comboBuyable(c),
                        )
                        const selected = (comboSel[t.name] ?? "").toLowerCase() === v.toLowerCase()
                        return (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={t.name + ": " + v + (buyable ? "" : " (out of stock)")}
                            title={buyable ? v : v + " - out of stock"}
                            disabled={!buyable}
                            onClick={() => setComboSel(chosen)}
                            className={
                              "min-h-11 min-w-11 rounded-xl border px-3 py-2 text-sm font-bold transition-colors " +
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
                              (selected
                                ? "border-primary bg-muted text-foreground ring-2 ring-primary"
                                : "border-border bg-card text-foreground hover:border-primary/60") +
                              (!buyable ? " cursor-not-allowed opacity-60 line-through" : "")
                            }
                          >
                            {v}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <PeerOffersList
              offers={hasMatrix ? matrixPeers : peerOffers}
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
              unavailableReason={unavailableReason}
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
            unavailableReason={unavailableReason}
          />
        </div>
      ) : null}

      {/* Related rail only when it has content (loading skeleton or items) —
          a bare heading over empty space reads as unfinished. */}
      {p && (relatedQ.isLoading || (relatedQ.data?.products.length ?? 0) > 0) ? (
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
        <BottomBar>
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
            className="min-h-11 min-w-[7.5rem] shrink-0 font-bold"
            disabled={!canAdd || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? "…" : "Add"}
          </Button>
        </BottomBar>
      ) : null}
    </div>
  )
}
