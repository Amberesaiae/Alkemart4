import { Check } from "@phosphor-icons/react"
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
  /** Hubtel pattern: Add → cart, Buy Now → straight to checkout. */
  onBuyNow?: () => void
  buyNowPending?: boolean
  sellerName?: string | null
  sellerHandle?: string | null
  /** Shown instead of "Currently unavailable" (e.g. paused-shop reason). */
  unavailableReason?: string | null
  className?: string
  sticky?: boolean
}

/**
 * Hubtel-mall buy box — price, stock, qty, Add to cart, Buy Now,
 * seller card, delivery + secure-payments (Paystack: MoMo + cards).
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
  onBuyNow,
  buyNowPending,
  sellerName,
  sellerHandle,
  unavailableReason,
  className,
  sticky,
}: Props) {
  const lineAmount =
    amount != null && Number.isFinite(amount) ? amount * quantity : amount

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm",
        sticky && "lg:sticky lg:top-24",
        className,
      )}
    >
      <Price
        amount={lineAmount}
        currencyCode={currencyCode}
        size="lg"
        className="text-2xl font-bold text-tone-brand-ink"
      />

      {canAdd ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-tone-success-ink">
          <span className="size-2 rounded-full bg-tone-success" />
          <span>In Stock · Cash on Delivery available</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
          <span className="size-2 rounded-full bg-destructive" />
          <span>{unavailableReason ?? "Currently unavailable"}</span>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
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
        disabled={!canAdd || pending || buyNowPending}
        onClick={onAdd}
      >
        {pending
          ? "Adding to cart…"
          : quantity > 1
            ? `Add ${quantity} to cart`
            : "Add to cart"}
      </Button>

      {onBuyNow ? (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="min-h-11 w-full font-bold"
          disabled={!canAdd || pending || buyNowPending}
          onClick={onBuyNow}
        >
          {buyNowPending ? "Processing…" : "Buy now"}
        </Button>
      ) : null}

      <Button
        asChild
        size="lg"
        variant="outline"
        className="min-h-11 w-full"
      >
        <Link to="/cart">View cart</Link>
      </Button>

      {sellerHandle ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sold by
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-bold text-foreground">
              {sellerName ?? "seller"}
            </span>
            <Link
              to="/shops/$slug"
              params={{ slug: sellerHandle }}
              className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:text-primary"
            >
              Visit shop
            </Link>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Secure payments via Paystack
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
          {["MTN MoMo", "Telecel Cash", "AirtelTigo", "Visa", "Mastercard"].map(
            (m) => (
              <li
                key={m}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                {m}
              </li>
            ),
          )}
        </ul>
      </div>

      {success ? (
        <div
          className="rounded-lg bg-tone-success-soft text-tone-success-ink border border-tone-success/40 p-3 text-center text-sm font-medium"
          aria-live="polite"
        >
          <Check size={14} weight="bold" aria-hidden className="mr-1 inline" /> Added to your cart!{" "}
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
