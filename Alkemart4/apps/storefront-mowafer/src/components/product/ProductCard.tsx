import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { ShoppingCart, Star } from "@phosphor-icons/react"
import { Button, Price } from "@workspace/ui"
import type { StoreProductCard } from "@/lib/products"
import { addOfferToCart } from "@/lib/cart"
import { cardRating } from "@/lib/product-rating"
import { cn } from "@/lib/utils"

export type ProductCardSize = "tile" | "row"

type Props = {
  product: StoreProductCard
  size?: ProductCardSize
  className?: string
}

/**
 * Shared card atom: image · title · seller · price · rating (if earned) · yellow Add.
 */
export function ProductCard({ product, size = "tile", className }: Props) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const rating = cardRating(product.ratingAvg, product.ratingCount)
  const canAdd = Boolean(product.offerId)
  const detailId = product.handle?.trim() || product.id

  async function onAdd() {
    if (!product.offerId) return
    setPending(true)
    try {
      await addOfferToCart(product.offerId, 1)
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
    } finally {
      setPending(false)
    }
  }

  const addBtn = (
    <Button
      type="button"
      size="icon"
      className="size-9 shrink-0 rounded-full"
      disabled={!canAdd || pending}
      onClick={() => void onAdd()}
      aria-label="Add to cart"
      title={canAdd ? "Add" : "Unavailable"}
    >
      <ShoppingCart size={16} weight="bold" />
    </Button>
  )

  if (size === "row") {
    return (
      <article
        className={cn(
          "flex overflow-hidden rounded-xl border border-border bg-card shadow-xs",
          className,
        )}
      >
        <Media product={product} detailId={detailId} className="aspect-square w-[30%] max-w-[112px] shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3">
          <Title product={product} detailId={detailId} />
          <SellerLine product={product} />
          <div className="flex items-center justify-between gap-2">
            <Price amount={product.amount} currency={(product.currencyCode ?? "GHS").toUpperCase()} size="sm" />
            {addBtn}
          </div>
          <RatingLine rating={rating} />
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <Media product={product} detailId={detailId} className="aspect-square w-full" />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Title product={product} detailId={detailId} />
        <SellerLine product={product} />
        <RatingLine rating={rating} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Price amount={product.amount} currency={(product.currencyCode ?? "GHS").toUpperCase()} size="md" />
          {addBtn}
        </div>
      </div>
    </article>
  )
}

function Media({
  product,
  detailId,
  className,
}: {
  product: StoreProductCard
  detailId: string
  className?: string
}) {
  const src = product.thumbnail
  return (
    <Link to="/product/$id" params={{ id: detailId }} className={cn("relative block overflow-hidden bg-muted", className)}>
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {product.categoryLabel || "No photo"}
        </span>
      )}
    </Link>
  )
}

function Title({ product, detailId }: { product: StoreProductCard; detailId: string }) {
  return (
    <Link
      to="/product/$id"
      params={{ id: detailId }}
      className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:underline"
    >
      {product.title}
    </Link>
  )
}

function SellerLine({ product }: { product: StoreProductCard }) {
  const name = product.seller?.name?.trim()
  if (!name) return null
  const handle = product.seller?.handle
  if (handle) {
    return (
      <Link
        to="/shops/$slug"
        params={{ slug: handle }}
        className="truncate text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {name}
      </Link>
    )
  }
  return <p className="truncate text-xs font-medium text-muted-foreground">{name}</p>
}

function RatingLine({
  rating,
}: {
  rating: ReturnType<typeof cardRating>
}) {
  if (!rating) return null
  return (
    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-label={rating.label}>
      <Star size={12} weight="fill" className="text-primary" aria-hidden />
      <span className="font-semibold text-foreground">{rating.value}</span>
      <span>({rating.count})</span>
    </p>
  )
}
