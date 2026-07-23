import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/price"
import { QtyStepper } from "@/components/qty-stepper"
import { cn } from "@/lib/utils"

type Props = {
  amount: number | null | undefined
  currencyCode: string | null | undefined
  quantity: number
  onQuantityChange: (n: number) => void
  canAdd: boolean
  pending?: boolean
  success?: boolean
  errorMessage?: string | null
  onAdd: () => void
  sellerName?: string | null
  sellerHandle?: string | null
  className?: string
  sticky?: boolean
}

/**
 * Mowafer buy panel — price, qty, primary cart CTA.
 * Reused on desktop column and compact mobile blocks.
 */
export function ProductBuyPanel({
  amount,
  currencyCode,
  quantity,
  onQuantityChange,
  canAdd,
  pending,
  success,
  errorMessage,
  onAdd,
  sellerName,
  sellerHandle,
  className,
  sticky,
}: Props) {
  const lineAmount =
    amount != null && Number.isFinite(amount) ? amount * quantity : amount

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm",
        sticky && "lg:sticky lg:top-24",
        className,
      )}
    >
      <Price
        amount={lineAmount}
        currencyCode={currencyCode}
        size="lg"
        className="text-xl font-bold"
      />

      {canAdd ? (
        <p className="text-sm font-semibold text-emerald-800">Ready to order</p>
      ) : (
        <p className="text-sm font-semibold text-destructive">
          Not available to buy yet
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Delivery fees are set by the seller and confirmed at checkout. Cash on
        delivery available.
      </p>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quantity
        </p>
        <QtyStepper
          value={quantity}
          onChange={onQuantityChange}
          disabled={!canAdd}
        />
      </div>

      <Button
        type="button"
        size="lg"
        className="min-h-12 w-full rounded-full font-bold"
        disabled={!canAdd || pending}
        onClick={onAdd}
      >
        {pending
          ? "Adding…"
          : quantity > 1
            ? `Add ${quantity} to cart`
            : "Add to cart"}
      </Button>

      <Button
        asChild
        size="lg"
        variant="outline"
        className="min-h-11 w-full rounded-full"
      >
        <Link to="/cart">View cart</Link>
      </Button>

      {sellerHandle ? (
        <Link
          to="/shops/$slug"
          params={{ slug: sellerHandle }}
          className="block text-center text-sm font-semibold underline underline-offset-2"
        >
          Visit {sellerName ?? "seller"} store
        </Link>
      ) : null}

      {success ? (
        <p
          className="rounded-full bg-primary/20 px-3 py-2 text-center text-sm font-medium"
          aria-live="polite"
        >
          Item added to cart.{" "}
          <Link to="/cart" className="underline">
            View cart
          </Link>
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
