import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { OptionPicker } from "@/components/commerce/option-picker"
import { OfferList } from "@/components/commerce/offer-list"
import { Price } from "@/components/commerce/price"
import { QtyStepper } from "@/components/commerce/qty-stepper"
import { useOfferSelection } from "@/hooks/use-offer-selection"
import { useAddToCart, qk } from "@/hooks/use-store"
import { useIsDesktop } from "@/hooks/use-media-query"
import { getStoreProduct, productParam } from "@/lib/products"

/**
 * Choose options and seller without leaving the shelf. Uses the same
 * selection rules as the PDP, so a card can never add something the PDP
 * would have refused.
 */
export function QuickBuySheet({
  productId,
  open,
  onOpenChange,
}: {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const desktop = useIsDesktop()
  const productQ = useQuery({
    queryKey: qk.product(productId),
    queryFn: () => getStoreProduct(productId),
    enabled: open,
  })
  const p = productQ.data
  const { selection, selectOption, selectOffer } = useOfferSelection(open ? p : undefined)
  const [qty, setQty] = useState(1)
  const add = useAddToCart()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl md:max-w-md md:rounded-none"
      >
        <SheetHeader className="border-b border-border pb-4">
          <div className="flex gap-3 pr-8">
            {p?.thumbnail ? (
              <img
                src={p.thumbnail}
                alt=""
                className="size-20 shrink-0 rounded-2xl bg-surface object-contain p-1.5 mix-blend-multiply"
              />
            ) : (
              <Skeleton className="size-20 rounded-2xl" />
            )}
            <div className="min-w-0 space-y-1">
              <SheetTitle className="line-clamp-2 text-base leading-snug">
                {p?.title ?? "Loading…"}
              </SheetTitle>
              <SheetDescription asChild>
                <div>
                  <Price amount={selection?.displayAmount} currency={selection?.displayCurrency} size="lg" />
                </div>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {productQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-11 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
          ) : productQ.isError ? (
            <p className="text-sm text-destructive">Couldn't load this product. Try again.</p>
          ) : selection ? (
            <>
              {selection.hasMatrix ? (
                <OptionPicker options={selection.options} onSelect={selectOption} />
              ) : null}
              {selection.candidates.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    Choose a seller <span className="font-normal text-muted-foreground">({selection.candidates.length})</span>
                  </p>
                  <OfferList
                    compact
                    offers={selection.candidates}
                    activeOfferId={selection.activeOfferId}
                    onChoose={selectOffer}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-auto space-y-2 border-t border-border bg-popover p-4 pb-safe">
          {selection?.blockedReason ? (
            <p className="text-center text-xs font-medium text-muted-foreground">{selection.blockedReason}</p>
          ) : null}
          <div className="flex items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} disabled={!selection?.canBuy} />
            <Button
              variant="brand"
              size="xl"
              className="flex-1"
              disabled={!selection?.canBuy || add.isPending}
              onClick={() =>
                selection?.activeOfferId &&
                add.mutate(
                  {
                    offerId: selection.activeOfferId,
                    qty,
                    productId: p?.id,
                    title: p?.title,
                    price: selection.displayAmount,
                    currency: selection.displayCurrency,
                  },
                  { onSuccess: () => onOpenChange(false) },
                )
              }
            >
              {add.isPending ? "Adding…" : "Add to cart"}
            </Button>
          </div>
          {p ? (
            <Link
              to="/product/$id"
              params={{ id: productParam(p) }}
              className="block text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View full details
            </Link>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
