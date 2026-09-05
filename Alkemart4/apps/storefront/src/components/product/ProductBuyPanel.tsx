import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui"
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
        className="text-2xl font-extrabold text-foreground"
      />

      {canAdd ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>In Stock · Cash on Delivery available</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
          <span className="size-2 rounded-full bg-destructive" />
          <span>Currently unavailable</span>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <span>📦</span>
          <span>Fast Ghana Delivery</span>
        </div>
        <p className="leading-relaxed">
          Delivery fees are set by the seller and confirmed at checkout. Pay cash or MoMo when your order arrives.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quantity
        </label>
        <QtyStepper
          value={quantity}
          onChange={onQuantityChange}
          disabled={!canAdd}
        />
      </div>

      <Button
        type="button"
        size="lg"
        className="min-h-12 w-full font-bold shadow-sm"
        disabled={!canAdd || pending}
        onClick={onAdd}
      >
        {pending
          ? "Adding to cart…"
          : quantity > 1
            ? `Add ${quantity} to cart`
            : "Add to cart"}
      </Button>

      <Button
        asChild
        size="lg"
        variant="outline"
        className="min-h-11 w-full"
      >
        <Link to="/cart">View cart</Link>
      </Button>

      {sellerHandle ? (
        <div className="pt-1 text-center">
          <Link
            to="/shops/$slug"
            params={{ slug: sellerHandle }}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Sold by <span className="text-foreground font-bold">{sellerName ?? "seller"}</span>
          </Link>
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 p-3 text-center text-sm font-medium"
          aria-live="polite"
        >
          ✓ Added to your cart!{" "}
          <Link to="/cart" className="font-bold underline ml-1">
            View cart
          </Link>
        </div>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
