import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Price } from "@/components/price"
import { SellerChip } from "@/components/seller-chip"
import { AddToCartControl } from "@/components/product/AddToCartControl"
import { WishlistButton } from "@/components/product/WishlistButton"
import type { StoreProductCard } from "@/lib/products"
import { addOfferToCart } from "@/lib/cart"
import { cn } from "@/lib/utils"

/**
 * Card sizes:
 *  tile — default 4-up grid (PLP, home, search, store, related)
 *  row  — list mode only (image left, compact body)
 *  hero | feature | md | sm — aliases → tile (hierarchy retired for density)
 */
export type ProductCardSize =
  | "hero"
  | "feature"
  | "row"
  | "tile"
  | "md"
  | "sm"

/** @deprecated prefer size */
export type ProductCardDensity = "compact" | "comfortable"

type ProductCardProps = {
  product: StoreProductCard
  className?: string
  density?: ProductCardDensity
  size?: ProductCardSize
}

const shell =
  "group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-foreground/15 hover:shadow-md"

/**
 * Concise retail card: image · title (2 lines) · price + cart.
 * No description, no category banner, no rating clutter on grid.
 */
export function ProductCard({
  product,
  className,
  density = "comfortable",
  size = "tile",
}: ProductCardProps) {
  const row = size === "row"
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const canAdd = Boolean(product.offerId)
  const detailId = product.handle?.trim() || product.id

  async function onAdd() {
    if (!product.offerId) {
      setError("Unavailable")
      return
    }
    setPending(true)
    setError(null)
    setOk(false)
    try {
      await addOfferToCart(product.offerId, 1)
      setOk(true)
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setPending(false)
    }
  }

  const cart = {
    pending,
    ok,
    disabled: !canAdd || pending,
    onClick: () => void onAdd(),
    title: "Add to cart",
  }

  if (row) {
    return (
      <article
        className={cn(
          shell,
          "flex h-full max-h-[112px] flex-row items-stretch",
          className,
        )}
      >
        <Media
          product={product}
          detailId={detailId}
          className="aspect-square w-[30%] max-w-[112px] shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-2.5">
          <Title product={product} detailId={detailId} />
          <SellerChip seller={product.seller} short className="line-clamp-1" />
          <div className="flex items-center justify-between gap-2">
            <Price
              amount={product.amount}
              currencyCode={product.currencyCode}
              size="sm"
              className="font-bold"
            />
            <div className="flex items-center gap-0.5">
              <WishlistButton productId={product.id} size={14} />
              <AddToCartControl variant="icon" {...cart} />
            </div>
          </div>
          {error ? <ErrorLine message={error} /> : null}
        </div>
      </article>
    )
  }

  /* Default tile — 4-up grid */
  return (
    <article className={cn(shell, "flex h-full flex-col", className)}>
      <Media
        product={product}
        detailId={detailId}
        className="aspect-square w-full shrink-0"
        showWish
      />
      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <Title product={product} detailId={detailId} />
        <SellerChip
          seller={product.seller}
          short
          className="line-clamp-1 text-[11px]"
        />
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-1">
          <Price
            amount={product.amount}
            currencyCode={product.currencyCode}
            size="sm"
            className="min-w-0 truncate font-bold tabular-nums"
          />
          <AddToCartControl variant="icon" {...cart} />
        </div>
        {error ? <ErrorLine message={error} /> : null}
      </div>
    </article>
  )
}

function Media(props: {
  product: StoreProductCard
  detailId: string
  className?: string
  showWish?: boolean
}) {
  const { product, detailId, className, showWish } = props
  const inner = product.thumbnail ? (
    <img
      src={product.thumbnail}
      alt=""
      className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.03]"
      loading="lazy"
    />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center bg-muted"
      aria-hidden
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
        {(product.title || "A").trim().charAt(0).toUpperCase()}
      </span>
    </div>
  )

  return (
    <Link
      to="/product/$id"
      params={{ id: detailId }}
      className={cn("relative block w-full bg-muted/30", className)}
    >
      {inner}
      {showWish ? (
        <span className="absolute right-1.5 top-1.5 z-10">
          <WishlistButton productId={product.id} onMedia size={13} />
        </span>
      ) : null}
    </Link>
  )
}

function Title(props: {
  product: StoreProductCard
  detailId: string
  className?: string
}) {
  return (
    <Link to="/product/$id" params={{ id: props.detailId }}>
      <h3
        className={cn(
          "line-clamp-2 min-h-[2.25rem] text-[13px] font-medium leading-snug text-foreground sm:text-sm",
          props.className,
        )}
      >
        {props.product.title}
      </h3>
    </Link>
  )
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="text-[11px] leading-tight text-destructive" role="alert">
      {message}
    </p>
  )
}
