import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Price } from "@/components/price"
import { SellerChip } from "@/components/seller-chip"
import { AddToCartControl } from "@/components/product/AddToCartControl"
import { WishlistButton } from "@/components/product/WishlistButton"
import { Icon } from "@/design/icons"
import { brand } from "@/design/brand"
import { Badge } from "@workspace/ui"
import { deptThemeClass } from "@/lib/category-theme"
import { iconForCategory } from "@/lib/catalog-nav"
import type { StoreProductCard } from "@/lib/products"
import { addOfferToCart } from "@/lib/cart"
import { sellersHintText } from "@/lib/sellers-hint"
import { cardRating } from "@/lib/product-rating"
import { QuickBuyDialog } from "@/components/product/QuickBuyDialog"
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
 * Concise retail card: image · title (2 lines) · seller · price · trust.
 *
 * Surfaces the facts a Ghana marketplace buyer needs before clicking: which
 * shop sells it, what it costs, whether anyone has rated it, how many sellers
 * compete, what stock is left, and the "from" price when peer sellers exist.
 * Add-to-cart floats on the artwork, so the price never shares its row.
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
  const [quickBuy, setQuickBuy] = useState(false)

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
          </div>
          <TrustRow product={product} />
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

  /* Default tile — 4-up grid.
     Four facts, in the order a marketplace buyer needs them: what it is,
     who sells it, what it costs, whether anyone trusts them. Add-to-cart
     floats on the image so the price row never has to share its width. */
  return (
    <article className={cn(shell, "flex h-full flex-col", className)}>
      <Media
        product={product}
        detailId={detailId}
        className="aspect-square w-full shrink-0"
        showWish
        stock={stock}
        cart={cart}
        onQuickView={() => setQuickBuy(true)}
      />
      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <Title product={product} detailId={detailId} />
        <div className="flex min-w-0 items-center gap-1.5">
          <SellerChip
            seller={product.seller}
            short
            className="line-clamp-1 type-sm"
          />
        </div>
        <div className="mt-auto flex flex-col gap-0.5 pt-1">
          <Price
            amount={product.amount}
            currencyCode={product.currencyCode}
            size="sm"
            from={multiSeller}
            className="min-w-0 truncate font-bold tabular-nums"
          />
          <TrustRow product={product} />
        </div>
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
    // Espresso rather than a hue: unavailable reads as "closed", not "alert".
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
  showWish?: boolean
  stock?: ReturnType<typeof stockState>
  /** Floating add-to-cart on the artwork (tile only). */
  cart?: CartControl
  /** When set, the artwork opens quick buy instead of navigating. */
  onQuickView?: () => void
}) {
  const { product, detailId, className, showWish, stock, cart, onQuickView } = props
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

  /* The link fills the frame; the controls are siblings, not children.
     Nesting a button inside an anchor is invalid and leaves screen-reader
     and keyboard users with an ambiguous target. */
  /* The artwork opens quick buy; the card title stays a real anchor to the
     product page, so deep links, new-tab opens and crawlers all still work.
     Browsing a marketplace is many small decisions, and a full page load
     between each one is the tax that stops it. */
  return (
    <div className={cn("relative w-full overflow-hidden bg-muted/30", className)}>
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
      {showWish ? (
        <span className="absolute left-2 top-2 z-10">
          <WishlistButton productId={product.id} onMedia size={13} />
        </span>
      ) : null}
      {cart ? (
        <span className="absolute right-2 top-2 z-10">
          <AddToCartControl variant="icon" {...cart} />
        </span>
      ) : null}
    </div>
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

/**
 * Rating on the left, peer-seller count on the right.
 *
 * A product with no published reviews renders no rating at all — not a
 * zero, not a greyed-out star row. An unearned score is worse than a
 * missing one, because it teaches buyers to discount every score on the
 * page. The whole row disappears when neither fact exists.
 */
function TrustRow({ product }: { product: StoreProductCard }) {
  const rating = cardRating(product.ratingAvg, product.ratingCount)
  const hint = sellersHintText(product.offerCount)
  if (!rating && !hint) return null

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      {rating ? (
        <span
          className="inline-flex shrink-0 items-center gap-1 type-sm tabular-nums text-muted-foreground"
          aria-label={rating.label}
        >
          <StarGlyph />
          <span className="font-semibold text-foreground">{rating.value}</span>
          <span aria-hidden>({rating.count})</span>
        </span>
      ) : (
        <span />
      )}
      {hint ? (
        <span
          className="truncate type-sm text-muted-foreground"
          data-testid="sellers-hint"
        >
          {hint}
        </span>
      ) : null}
    </div>
  )
}

/** Inline so the star never depends on an icon asset resolving. */
function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        d="M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
        fill={brand.primary}
      />
    </svg>
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
