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
import { cardRating } from "@/lib/product-rating"
import { QuickBuyDialog } from "@/components/product/QuickBuyDialog"
import { cn } from "@/lib/utils"

export type ProductCardSize =
  | "hero"
  | "feature"
  | "row"
  | "store"
  | "tile"
  | "md"
  | "sm"

/** @deprecated prefer size */
export type ProductCardDensity = "compact" | "comfortable"

export type ProductCardProps = {
  product: StoreProductCard
  className?: string
  density?: ProductCardDensity
  size?: ProductCardSize
  /** Seller identity may be omitted when the surrounding section already names one shop. */
  hideSeller?: boolean
  /** Home editorial rails can suppress comparison metadata to keep cards quiet. */
  hideSellerCount?: boolean
  imageFit?: "contain" | "cover"
}

/** Stock states surfaced on the card — fewer dead-end add-to-cart clicks. */
function stockState(product: StoreProductCard): "in" | "low" | "out" | "unknown" {
  const qty = product.availableQty
  if (qty == null) return product.offerId ? "in" : "unknown"
  if (qty <= 0) return "out"
  if (qty <= 5) return "low"
  return "in"
}

/**
 * Alkemart Product Card layout:
 * - Rounded image card at top with Alkemart gold (+) add-to-cart button
 * - Information completely outside the card, with exact text hierarchy:
 *   1. Product Name (truncate, text-sm font-semibold text-foreground)
 *   2. Vendor / Shop name (truncate, text-xs text-muted-foreground)
 *   3. Figure / Price (bold text-tone-brand-ink tabular-nums)
 *   4. Rating (★ score (count), gold star text-amber-500, text-foreground score, muted count)
 */
export function ProductCard({
  product,
  className,
  size = "tile",
  hideSeller = false,
  imageFit = "cover",
}: ProductCardProps) {
  const row = size === "row"
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [quickBuy, setQuickBuy] = useState(false)

  const stock = stockState(product)
  const soldOut = stock === "out"
  const canAdd = Boolean(product.offerId) && !soldOut
  // Slug-id URLs when the card carries a slug; legacy handle/id otherwise.
  // The route resolves every form, so no link here can 404 on shape alone.
  const detailId = product.slug?.trim()
    ? `${product.slug.trim()}-${product.id}`
    : product.handle?.trim() || product.id

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
          "group flex h-full max-h-[112px] flex-row items-stretch overflow-hidden rounded-lg border border-black/[0.08] bg-card shadow-xs",
          className,
        )}
      >
        <Media
          product={product}
          detailId={detailId}
          className="aspect-square w-[30%] max-w-[112px] shrink-0"
          imageFit="cover"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-2.5">
          <Link
            to="/product/$id"
            params={{ id: detailId }}
            className="rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary-strong">
              {product.title}
            </h3>
          </Link>
          {!hideSeller ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <SellerChip seller={product.seller} short className="line-clamp-1" />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Price
              amount={product.amount}
              currencyCode={product.currencyCode}
              size="sm"
              className="min-w-0 truncate whitespace-nowrap font-bold text-tone-brand-ink"
            />
            <div className="flex shrink-0 items-center gap-0.5">
              <WishlistButton productId={product.id} size={14} />
              <AddToCartControl
                variant="icon"
                {...cart}
                className="size-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary-strong"
              />
            </div>
          </div>
          {error ? <ErrorLine message={error} /> : null}
        </div>
      </article>
    )
  }

  const rating = cardRating(product.ratingAvg, product.ratingCount)

  return (
    <article
      className={cn(
        "group flex h-full w-full flex-col text-left",
        className,
      )}
    >
      {/* 1. Top Image Card */}
      <Media
        product={product}
        detailId={detailId}
        className="aspect-square w-full shrink-0 rounded-lg overflow-hidden bg-muted/20 dark:bg-muted/40 ring-1 ring-black/[0.04]"
        imageFit={imageFit}
        stock={stock}
        cart={cart}
        onQuickView={() => setQuickBuy(true)}
      />

      {/* 2. Text information completely outside the card — all lines uniform size (text-sm sm:text-base) */}
      <div className="flex flex-1 flex-col pt-2.5 pb-1 gap-1 min-w-0">
        {/* Line 1: Product Name */}
        <Link
          to="/product/$id"
          params={{ id: detailId }}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <h3
            title={product.title}
            className="truncate text-sm sm:text-base font-semibold text-foreground group-hover:text-primary-strong leading-snug"
          >
            {product.title}
          </h3>
        </Link>

        {/* Line 2: Vendor */}
        {product.seller?.name || product.seller?.handle ? (
          <p className="truncate text-sm sm:text-base text-muted-foreground leading-snug">
            {product.seller.name || product.seller.handle}
          </p>
        ) : null}

        {/* Line 3: Figure (Price in Alkemart brand bronze) */}
        <div className="pt-0.5 leading-snug">
          <Price
            amount={product.amount}
            currencyCode={product.currencyCode}
            size="md"
            className="min-w-0 truncate whitespace-nowrap text-sm sm:text-base font-bold tabular-nums text-tone-brand-ink"
          />
        </div>

        {/* Line 4: Rating (★ value (count)) or quiet placeholder */}
        {rating ? (
          <div
            className="flex items-center gap-1.5 text-sm sm:text-base tabular-nums font-medium pt-0.5 leading-snug"
            aria-label={rating.label}
          >
            <span className="text-sm sm:text-base text-amber-500 font-bold" aria-hidden="true">★</span>
            <span className="font-semibold text-foreground">{rating.value}</span>
            <span className="text-muted-foreground/80 font-normal">({rating.count})</span>
          </div>
        ) : (
          <div className="pt-0.5 text-xs text-muted-foreground/50 leading-snug">
            No reviews yet
          </div>
        )}

        {error ? <ErrorLine message={error} /> : null}
      </div>

      <QuickBuyDialog
        product={product}
        open={quickBuy}
        onClose={() => setQuickBuy(false)}
      />
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
    return (
      <Badge tone="neutral" emphasis="solid" className="bg-ink text-white">
        Sold out
      </Badge>
    )
  }
  return null
}

type CartControl = {
  pending: boolean
  ok: boolean
  disabled: boolean
  onClick: () => void
  title: string
}

function Media(props: {
  product: StoreProductCard
  detailId: string
  className?: string
  stock?: ReturnType<typeof stockState>
  /** Floating add-to-cart on the artwork. */
  cart?: CartControl
  /** When set, the artwork opens quick buy instead of navigating. */
  onQuickView?: () => void
  imageFit?: "contain" | "cover"
}) {
  const { product, detailId, className, stock, cart, onQuickView, imageFit = "cover" } = props
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const title = (product.title || "Product").trim()
  const web = product.webUrl
  const thumb = product.thumbUrl
  const fallback =
    product.thumbnail ||
    product.images?.[0]?.url ||
    undefined
  const src = !broken ? (web ?? thumb ?? fallback) : undefined
  const inner = src ? (
    <>
      {!loaded ? <span className="merch-shimmer absolute inset-0 z-0 block" aria-hidden /> : null}
      <img
        src={src}
        srcSet={buildSrcSet(web, thumb, fallback)}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        className={cn(
          "relative z-[1] h-full w-full",
          // Out-of-stock products stay on the shelf now, so the artwork has to
          // say so at a glance — the badge alone reads as decoration in a grid.
          props.stock === "out" && "opacity-45 saturate-50",
          imageFit === "contain" ? "object-contain p-2.5 sm:p-3" : "object-cover",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
      />
    </>
  ) : (
    <div
      className={cn(
        "cat-fallback flex h-full w-full items-center justify-center p-3",
        deptThemeClass(product.categoryLabel ?? "", product.categoryHandles?.[0]),
      )}
      aria-hidden="true"
    >
      <span className="cat-fallback-glyph">
        <Icon
          name={iconForCategory(product.categoryLabel ?? "", product.categoryHandles?.[0])}
          size={28}
        />
      </span>
    </div>
  )

  return (
    <div className={cn("relative w-full overflow-hidden bg-muted/20 dark:bg-muted/40 rounded-lg", className)}>
      {onQuickView ? (
        <button
          type="button"
          onClick={onQuickView}
          aria-haspopup="dialog"
          aria-label={`Quick view: ${title}`}
          className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {inner}
        </button>
      ) : (
        <Link
          to="/product/$id"
          params={{ id: detailId }}
          className="block h-full w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={title}
        >
          {inner}
        </Link>
      )}
      {stock && stock !== "in" && stock !== "unknown" ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-10">
          <StockBadge stock={stock} />
        </span>
      ) : null}
      {cart ? (
        <span className="absolute right-2 top-2 z-10">
          <AddToCartControl
            variant="icon"
            {...cart}
            className="size-7 sm:size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary-strong shadow-xs"
          />
        </span>
      ) : null}
    </div>
  )
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="type-sm leading-tight text-destructive pt-0.5" role="alert">
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
