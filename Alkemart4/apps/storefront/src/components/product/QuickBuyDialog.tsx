import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@workspace/ui"
import { ArrowUpRight, Minus, Plus } from "@phosphor-icons/react"
import { Price } from "@/components/price"
import { Skeleton } from "@/components/skeleton"
import { ProductAttributes } from "@/components/product/ProductAttributes"
import { getStoreProduct, type StoreProductCard } from "@/lib/products"
import { addOfferToCart } from "@/lib/cart"
import { sellersHintText } from "@/lib/sellers-hint"
import { cn } from "@/lib/utils"

/**
 * Quick buy — add from a grid without losing your place.
 *
 * A marketplace shop is eight items in one sitting, and a full page load
 * between each one is the tax that stops it. This dialog carries exactly what
 * a buyer needs to commit: the art at a readable size, the price, the facts
 * that confirm it is the right size of the right thing, and a quantity.
 *
 * It does not replace the product page. Peer offers, variants and reviews
 * need room, and deep links and search engines need a real URL — so the
 * dialog always links through.
 */
export function QuickBuyDialog({
  product,
  open,
  onClose,
}: {
  /** The grid's card — shown immediately so the dialog never opens empty. */
  product: StoreProductCard
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [qty, setQty] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  const detailId = product.slug?.trim()
    ? `${product.slug.trim()}-${product.id}`
    : product.handle?.trim() || product.id

  // The card has no attributes — those live on the detail payload. Fetch them
  // only once the dialog is actually open.
  const detailQ = useQuery({
    queryKey: ["store", "product", detailId],
    queryFn: () => getStoreProduct(detailId),
    enabled: open,
    staleTime: 60_000,
  })

  const detail = detailQ.data ?? product
  const attributes = detail.attributes ?? []
  const peers = sellersHintText(detail.offerCount)
  const canAdd = Boolean(detail.offerId)

  useEffect(() => {
    if (!open) return
    setQty(1)
    setError(null)
    setAdded(false)
  }, [open, detailId])

  async function onAdd() {
    if (!detail.offerId) {
      setError("This item is not available right now.")
      return
    }
    setPending(true)
    setError(null)
    try {
      await addOfferToCart(detail.offerId, qty)
      setAdded(true)
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to cart.")
    } finally {
      setPending(false)
    }
  }

  const image =
    detail.webUrl ?? detail.thumbUrl ?? detail.thumbnail ?? detail.images?.[0]?.url ?? null

  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-md">
      <div className="space-y-3">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
          {image ? (
            <img
              src={image}
              alt={detail.title}
              className="h-full w-full object-contain p-3"
              decoding="async"
            />
          ) : null}
        </div>

        <h2 className="pr-8 text-lg font-bold leading-snug">{detail.title}</h2>

        <Price
          amount={detail.amount}
          currencyCode={detail.currencyCode}
          size="lg"
          className="block"
        />

        {detailQ.isLoading ? (
          <Skeleton className="h-8 w-full rounded-md" />
        ) : (
          <ProductAttributes attributes={attributes} />
        )}

        {detail.seller ? (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Sold by{" "}
            <Link
              to="/shops/$slug"
              params={{ slug: detail.seller.handle ?? "" }}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {detail.seller.name}
            </Link>
            {peers ? <> · {peers}</> : null}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        {added ? (
          <p role="status" className="text-sm font-semibold text-foreground">
            Added to cart.{" "}
            <Link to="/cart" className="underline underline-offset-2">
              View cart
            </Link>
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 pt-1">
          <div className="flex items-center gap-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              className="grid h-10 w-10 place-items-center rounded-l-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Minus size={14} weight="bold" aria-hidden />
            </button>
            <span className="min-w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
              className="grid h-10 w-10 place-items-center rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus size={14} weight="bold" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={!canAdd || pending}
            className={cn(
              "h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground",
              "transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            {pending ? "Adding…" : canAdd ? "Add to cart" : "Unavailable"}
          </button>
        </div>

        <Link
          to="/product/$id"
          params={{ id: detailId }}
          className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          See full details
          <ArrowUpRight size={14} weight="bold" aria-hidden />
        </Link>
      </div>
    </Modal>
  )
}
