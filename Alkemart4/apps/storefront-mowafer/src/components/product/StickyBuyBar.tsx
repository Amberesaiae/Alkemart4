import { Button, Price } from "@workspace/ui"
import { cn } from "@/lib/utils"
import { normalizeCurrencyCode } from "@/lib/money"

type Props = {
  amount: number | null | undefined
  currencyCode: string | null | undefined
  canAdd: boolean
  pending?: boolean
  onAdd: () => void
  className?: string
}

export function StickyBuyBar({ amount, currencyCode, canAdd, pending, onAdd, className }: Props) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-14 z-40 border-t border-border bg-card/95 p-3 backdrop-blur md:hidden",
        "mb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-3">
        <Price
          amount={amount}
          currency={normalizeCurrencyCode(currencyCode)}
          size="md"
          className="font-bold"
        />
        <Button
          type="button"
          className="ms-auto rounded-full"
          disabled={!canAdd || pending}
          isLoading={pending}
          onClick={onAdd}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  )
}
