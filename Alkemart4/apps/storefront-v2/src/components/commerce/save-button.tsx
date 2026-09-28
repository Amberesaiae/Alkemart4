import { HugeiconsIcon } from "@hugeicons/react"
import { FavouriteIcon } from "@hugeicons/core-free-icons"
import { useSavedItems } from "@/lib/wishlist"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** Quiet, reversible toggle: the filled heart and aria-pressed convey state. */
export function SaveButton({
  product,
  className,
  variant = "floating",
}: {
  product: Pick<StoreProductCard, "id" | "title" | "slug" | "thumbnail" | "amount" | "currencyCode">
  className?: string
  variant?: "floating" | "inline"
}) {
  const { isSaved, toggle } = useSavedItems()
  const saved = isSaved(product.id)
  return (
    <Button
      variant={variant === "inline" ? "outline" : "ghost"}
      size="icon-lg"
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.title} from saved` : `Save ${product.title}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({
          id: product.id,
          title: product.title,
          slug: product.slug ?? null,
          thumbnail: product.thumbnail ?? null,
          amount: product.amount ?? null,
          currencyCode: product.currencyCode ?? null,
        })
      }}
      className={cn(
        variant === "floating"
          ? "bg-background/90 shadow-sm backdrop-blur hover:bg-background"
          : "",
        className,
      )}
    >
      <HugeiconsIcon
        icon={FavouriteIcon}
        className={cn("size-[18px]", saved ? "fill-deal text-deal" : "text-foreground")}
      />
    </Button>
  )
}
