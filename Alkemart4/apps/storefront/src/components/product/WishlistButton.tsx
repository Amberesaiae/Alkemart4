import { useState } from "react"
import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  className?: string
  size?: number
  /** Soft white circle behind icon (over product media) */
  onMedia?: boolean
}

/**
 * Mowafer wishlist control — bookmark symbol (not heart).
 * Local toggle only until a wishlist API exists.
 */
export function WishlistButton({
  productId,
  className,
  size = 16,
  onMedia = false,
}: Props) {
  const [on, setOn] = useState(false)

  return (
    <button
      type="button"
      aria-label={on ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={on}
      data-product-id={productId}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOn((v) => !v)
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition",
        onMedia
          ? "min-h-11 min-w-11 h-8 w-8 rounded-full bg-white/90 text-muted-foreground shadow-sm hover:text-primary"
          : "min-h-11 min-w-11 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-primary",
        on && "text-primary",
        className,
      )}
    >
      <IconSafe
        name="bookmark"
        size={size}
        preferAsset={false}
        className={on ? "[&_path]:fill-current" : undefined}
      />
    </button>
  )
}

/** @deprecated use WishlistButton */
export const WishlistHeart = WishlistButton
