import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ShoppingCartAdd01Icon } from "@hugeicons/core-free-icons"
import { Price } from "@/components/commerce/price"
import { BrandIcon } from "@/components/brand/brand-logo"
import { Rating } from "@/components/commerce/rating"
import { SaveButton } from "@/components/commerce/save-button"
import { QuickBuySheet } from "@/components/commerce/quick-buy-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAddToCart, qk } from "@/hooks/use-store"
import { getStoreProduct, productParam, type StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"
import { COMPARE_ENABLED } from "@/lib/features"

const NEW_DAYS = 14

/** Card badges are server facts only: stock, recency. Never a fake discount. */
function badgeFor(p: StoreProductCard): { label: string; tone: "dark" | "brand" | "muted" } | null {
  if (p.availableQty === 0) return { label: "Sold out", tone: "muted" }
  if (p.availableQty != null && p.availableQty > 0 && p.availableQty <= 3) {
    return { label: `Only ${p.availableQty} left`, tone: "dark" }
  }
  if (p.createdAt) {
    const age = Date.now() - Date.parse(p.createdAt)
    if (Number.isFinite(age) && age >= 0 && age < NEW_DAYS * 86_400_000) return { label: "New", tone: "brand" }
  }
  return null
}

export function ProductCard({
  product: p,
  className,
  priority,
}: {
  product: StoreProductCard
  className?: string
  /** Above-the-fold: load eagerly. */
  priority?: boolean
}) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const queryClient = useQueryClient()
  const add = useAddToCart()
  const soldOut = p.availableQty === 0
  const badge = badgeFor(p)
  const sellers = p.offerCount ?? 0
  // Thumb first (small), then the full photo if the thumb is missing, then the placeholder.
  const sources = [...new Set([p.thumbUrl, p.thumbnail, p.images?.[0]?.url].filter((u): u is string => !!u))]
  const [failed, setFailed] = useState(0)
  const image = sources[failed] ?? null

  /**
   * Direct add only when there is nothing to choose: one seller and no
   * variant options. Otherwise the quick-buy sheet asks, like the PDP.
   */
  async function onQuickAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (sellers > 1) return setQuickOpen(true)
    setResolving(true)
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: qk.product(p.id),
        queryFn: () => getStoreProduct(p.id),
        staleTime: 60_000,
      })
      const needsChoice = (detail.optionTypes?.length ?? 0) > 0 || (detail.offerCount ?? 0) > 1
      if (needsChoice || !detail.offerId) setQuickOpen(true)
      else
        add.mutate({
          offerId: detail.offerId,
          productId: p.id,
          title: p.title,
          price: detail.amount,
          currency: detail.currencyCode,
        })
    } catch {
      setQuickOpen(true)
    } finally {
      setResolving(false)
    }
  }

  return (
    <article className={cn("group/card relative flex flex-col", className)}>
      <Link
        to="/product/$id"
        params={{ id: productParam(p) }}
        className="flex flex-1 flex-col rounded-xl focus-visible:outline-offset-4 sm:rounded-3xl"
      >
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-xl bg-surface sm:rounded-3xl",
            soldOut && "opacity-60",
          )}
        >
          {image ? (
            <img
              src={image}
              alt={p.title}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setFailed((n) => n + 1)}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <BrandIcon className="size-10 opacity-20 grayscale" />
            </div>
          )}
          {badge ? (
            <span
              className={cn(
                "absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold sm:top-3 sm:left-3 sm:px-2.5 sm:py-1",
                badge.tone === "brand" && "bg-brand text-brand-foreground",
                badge.tone === "dark" && "bg-foreground text-background",
                badge.tone === "muted" && "bg-background text-muted-foreground",
              )}
            >
              {badge.label}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-0.5 px-0.5 pt-2 sm:gap-1 sm:px-1 sm:pt-3">
          {p.categoryLabel ? (
            <p className="product-card-eyebrow truncate text-xs font-medium text-muted-foreground">
              {p.categoryLabel}
            </p>
          ) : null}
          <h3 className="product-card-title line-clamp-2 text-[0.875rem] leading-snug font-medium text-foreground sm:text-base sm:font-semibold">{p.title}</h3>
          <Rating avg={p.ratingAvg} count={p.ratingCount} />
          <div className="mt-auto pt-1 pr-10 sm:pt-1.5 sm:pr-11">
            <Price amount={p.amount} currency={p.currencyCode} from={COMPARE_ENABLED && sellers > 1} />
            <p className="truncate text-[0.8125rem] text-muted-foreground sm:mt-0.5">
              {COMPARE_ENABLED && sellers > 1 ? (
                <span className="font-semibold text-foreground">{sellers} sellers</span>
              ) : p.seller?.name ? (
                <>by {p.seller.name}</>
              ) : null}
            </p>
          </div>
        </div>
      </Link>

      {/* Phones: 32px to see, 40px to tap (the ::after widens the target). */}
      <SaveButton product={p} className="absolute top-2 right-2 size-8 after:absolute after:-inset-1 sm:top-2.5 sm:right-2.5 sm:size-10 [&_svg]:size-4 sm:[&_svg]:size-[18px]" />

      {!soldOut ? (
        <button
          type="button"
          onClick={onQuickAdd}
          disabled={resolving || add.isPending}
          aria-label={sellers > 1 ? `Choose a seller for ${p.title}` : `Add ${p.title} to cart`}
          className="absolute right-0.5 bottom-0.5 grid size-9 place-items-center rounded-full bg-brand text-brand-foreground shadow-sm after:absolute after:-inset-0.5 disabled:opacity-70 sm:right-1 sm:bottom-1 sm:size-10"
        >
          {resolving || add.isPending ? (
            <Spinner className="size-4" />
          ) : (
            <HugeiconsIcon icon={ShoppingCartAdd01Icon} className="size-[18px]" />
          )}
        </button>
      ) : null}

      {quickOpen ? <QuickBuySheet productId={p.id} open={quickOpen} onOpenChange={setQuickOpen} /> : null}
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      <Skeleton className="aspect-square w-full rounded-3xl" />
      <Skeleton className="h-3.5 w-11/12" />
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
