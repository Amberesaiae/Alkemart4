import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/price"
import { SellerChip } from "@/components/seller-chip"
import type { StoreProductCard } from "@/lib/products"
import { addOfferToCart } from "@/lib/cart"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

type ProductCardProps = {
  product: StoreProductCard
  className?: string
}

/**
 * Catalog card — footprint matches ProductGridSkeleton:
 * square media + fixed body stack (title 2 lines, seller, price, CTA).
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const canAdd = Boolean(product.offerId)
  const detailId = product.handle?.trim() || product.id

  async function onAdd() {
    if (!product.offerId) {
      setError("This item is not available to buy yet")
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
      setError(err instanceof Error ? err.message : "Add to cart failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <article
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border border-border bg-card",
        className,
      )}
    >
      <Link
        to="/product/$id"
        params={{ id: detailId }}
        className="relative block aspect-square w-full shrink-0 overflow-hidden bg-muted"
      >
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        {!product.offerId ? (
          <span className="absolute left-2 top-2 bg-background/95 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            No offer
          </span>
        ) : null}
      </Link>

      <div className="flex min-h-[9.5rem] flex-1 flex-col gap-2 p-3">
        <div className="min-h-[2.75rem]">
          <Link to="/product/$id" params={{ id: detailId }} className="block">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {product.title}
            </h3>
          </Link>
        </div>

        <div className="min-h-[1rem]">
          <SellerChip seller={product.seller} className="text-[11px]" />
        </div>

        <div className="min-h-[1.25rem]">
          <Price
            amount={product.amount}
            currencyCode={product.currencyCode}
            size="md"
          />
        </div>

        <div className="mt-auto space-y-1">
          <Button
            type="button"
            size="sm"
            className="min-h-11 w-full rounded-none font-semibold shadow-none"
            disabled={!canAdd || pending}
            onClick={() => void onAdd()}
          >
            {pending ? "Adding…" : ok ? "Added" : "Add to cart"}
          </Button>
          {error ? (
            <p className="text-[11px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
