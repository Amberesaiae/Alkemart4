import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Price } from "@/components/price"
import { SellerChip } from "@/components/seller-chip"
import { AddToCartControl } from "@/components/product/AddToCartControl"
import { WishlistButton } from "@/components/product/WishlistButton"
import { Icon } from "@/design/icons"
import { Badge } from "@workspace/ui"
import { deptThemeClass } from "@/lib/category-theme"
import { iconForCategory } from "@/lib/catalog-nav"
import type { StoreProductCard } from "@/lib/products"
import { addOfferToCart } from "@/lib/cart"
import { sellersHintText } from "@/lib/sellers-hint"
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
  "group overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md"

/** Stock states surfaced on the card — fewer dead-end add-to-cart clicks. */
function stockState(product: StoreProductCard): "in" | "low" | "out" | "unknown" {
  const qty = product.availableQty
  if (qty == null) return product.offerId ? "in" : "unknown"
  if (qty <= 0) return "out"
  if (qty <= 5) return "low"
  return "in"
}

/**
 * Concise retail card: category line · image · title (2 lines) · seller ·
 * price + cart. Surfaces the facts a Ghana marketplace buyer needs before
 * clicking: which shop sells it, how many sellers compete, what stock is
 * left, and the "from" price when peer sellers exist.
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

  const stock = stockState(product)
  const soldOut = stock === "out"
  const canAdd = Boolean(product.offerId) && !soldOut
  const detailId = product.handle?.trim() || product.id
  const multiSeller = (product.offerCount ?? 0) > 1

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
    title: soldOut ? "Sold out" : "Add to cart",
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
          <CategoryLabel label={product.categoryLabel} />
          <Title product={product} detailId={detailId} />
          <div className="flex min-w-0 items-center gap-1.5">
            <SellerChip seller={product.seller} short className="line-clamp-1" />
            <SellersHint offerCount={product.offerCount} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Price
              amount={product.amount}
              currencyCode={product.currencyCode}
              size="sm"
              from={multiSeller}
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
        stock={stock}
      />
      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <CategoryLabel label={product.categoryLabel} />
        <Title product={product} detailId={detailId} />
        <div className="flex min-w-0 items-center gap-1.5">
          <SellerChip
            seller={product.seller}
            short
            className="line-clamp-1 type-sm"
          />
        </div>
        <SellersHint offerCount={product.offerCount} />
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-1">
          <Price
            amount={product.amount}
            currencyCode={product.currencyCode}
            size="sm"
            from={multiSeller}
            className="min-w-0 truncate font-bold tabular-nums"
          />
          <AddToCartControl variant="icon" {...cart} />
        </div>
        {error ? <ErrorLine message={error} /> : null}
      </div>
    </article>
  )
}

function StockBadge({ stock }: { stock: ReturnType<typeof stockState> }) {
  if (stock === "low") {
    return (
      <Badge tone="scarce" emphasis="solid">
        Few left
      </Badge>
    )
  }
  if (stock === "out") {
    // Espresso rather than a hue: unavailable reads as "closed", not "alert".
    return (
      <Badge tone="neutral" emphasis="solid" className="bg-ink text-white">
        Sold out
      </Badge>
    )
  }
  return null
}

function Media(props: {
  product: StoreProductCard
  detailId: string
  className?: string
  showWish?: boolean
  stock?: ReturnType<typeof stockState>
}) {
  const { product, detailId, className, showWish, stock } = props
  const [broken, setBroken] = useState(false)
  const title = (product.title || "Product").trim()
  // Prefer processed webp derivatives; fall back to raw thumbnail/images/original
  const web = product.webUrl
  const thumb = product.thumbUrl
  const fallback =
    product.thumbnail ||
    product.images?.[0]?.url ||
    undefined
  const src = !broken ? (web ?? thumb ?? fallback) : undefined
  const inner = src ? (
    <img
      src={src}
      srcSet={buildSrcSet(web, thumb, fallback)}
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      alt=""
      onError={() => setBroken(true)}
      className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      loading="lazy"
      decoding="async"
    />
  ) : (
    /* Designed no-photo tile: department tint + category glyph. Reads as
       intentional art direction, never as a broken image. */
    <div
      className={cn(
        "cat-fallback flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center",
        deptThemeClass(product.categoryLabel ?? "", product.categoryHandles?.[0]),
      )}
      aria-hidden="true"
    >
      <span className="cat-fallback-glyph">
        <Icon
          name={iconForCategory(product.categoryLabel ?? "", product.categoryHandles?.[0])}
          size={26}
        />
      </span>
      <span className="cat-fallback-word line-clamp-2 font-semibold uppercase tracking-[0.14em]">
        {product.categoryLabel?.trim() || title}
      </span>
    </div>
  )

  return (
    <Link
      to="/product/$id"
      params={{ id: detailId }}
      className={cn(
        "relative block w-full overflow-hidden bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      aria-label={title}
    >
      {inner}
      {stock && stock !== "in" && stock !== "unknown" ? (
        <span className="absolute left-2 top-2 z-10">
          <StockBadge stock={stock} />
        </span>
      ) : null}
      {showWish ? (
        <span className="absolute right-2 top-2 z-10">
          <WishlistButton productId={product.id} onMedia size={13} />
        </span>
      ) : null}
    </Link>
  )
}

function CategoryLabel({ label }: { label?: string | null }) {
  if (!label?.trim()) return null
  return (
    <p
      className="eyebrow line-clamp-1 text-muted-foreground"
      aria-label={`Category: ${label.trim()}`}
    >
      {label.trim()}
    </p>
  )
}

function SellersHint({ offerCount }: { offerCount?: number | null }) {
  const text = sellersHintText(offerCount)
  if (!text) return null
  return (
    <p className="type-sm text-muted-foreground" data-testid="sellers-hint">
      {text}
    </p>
  )
}

function Title(props: {
  product: StoreProductCard
  detailId: string
  className?: string
}) {
  return (
    <Link
      to="/product/$id"
      params={{ id: props.detailId }}
      className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <h3
        className={cn(
          "line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground",
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
    <p className="type-sm leading-tight text-destructive" role="alert">
      {message}
    </p>
  )
}

function buildSrcSet(
  web: string | null | undefined,
  thumb: string | null | undefined,
  fallback: string | undefined,
): string {
  const parts: string[] = []
  if (web) parts.push(`${web} 1600w`)
  if (thumb) parts.push(`${thumb} 400w`)
  if (fallback) parts.push(`${fallback} 1200w`)
  return parts.join(", ")
}
