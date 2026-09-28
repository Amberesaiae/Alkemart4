import { Link } from "@tanstack/react-router"
import { Button, Price } from "@workspace/ui"
import { cn } from "@/lib/utils"
import { normalizeCurrencyCode } from "@/lib/money"

type Props = {
  amount: number | null | undefined
  currencyCode: string | null | undefined
  quantity: number
  onQuantityChange: (n: number) => void
  canAdd: boolean
  pending?: boolean
  sellerName?: string | null
  sellerHandle?: string | null
  onAdd: () => void
  className?: string
}

export function BuyPanel({
  amount,
  currencyCode,
  quantity,
  onQuantityChange,
  canAdd,
  pending,
  sellerName,
  sellerHandle,
  onAdd,
  className,
}: Props) {
  return (
    <div className={cn("space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <Price
        amount={amount}
        currency={normalizeCurrencyCode(currencyCode)}
        size="lg"
        className="text-2xl font-extrabold"
      />

      {sellerName ? (
        sellerHandle ? (
          <Link
            to="/shops/$slug"
            params={{ slug: sellerHandle }}
            className="text-sm font-semibold hover:underline"
          >
            Sold by {sellerName}
          </Link>
        ) : (
          <p className="text-sm font-semibold">Sold by {sellerName}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Seller not named on this offer</p>
      )}

      <div className="flex items-center gap-2" aria-label="Quantity">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          aria-label="Decrease quantity"
        >
          −
        </Button>
        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onQuantityChange(quantity + 1)}
          aria-label="Increase quantity"
        >
          +
        </Button>
      </div>

      <Button
        type="button"
        className="w-full rounded-full"
        disabled={!canAdd || pending}
        isLoading={pending}
        onClick={onAdd}
      >
        Add to Cart
      </Button>
    </div>
  )
}
