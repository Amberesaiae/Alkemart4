import { HugeiconsIcon } from "@hugeicons/react"
import { FavouriteIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { useSavedItems } from "@/lib/wishlist"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

/** Heart toggle for the device-local Saved list. */
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
    <button
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
        toast(saved ? "Removed from Saved" : "Saved on this device")
      }}
      className={cn(
        "grid place-items-center rounded-full transition-colors",
        variant === "floating"
          ? "size-10 bg-background/90 shadow-sm backdrop-blur hover:bg-background"
          : "size-10 border border-border hover:bg-muted",
        className,
      )}
    >
      <HugeiconsIcon
        icon={FavouriteIcon}
        className={cn("size-[18px]", saved ? "fill-deal text-deal" : "text-foreground")}
      />
    </button>
  )
}
