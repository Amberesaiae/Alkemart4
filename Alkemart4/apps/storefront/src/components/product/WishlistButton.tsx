import { useCallback, useEffect, useState } from "react"
import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"
import { getSessionCustomer } from "@/lib/auth"
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "@/lib/wishlist"

type Props = {
  productId: string
  className?: string
  size?: number
  onMedia?: boolean
}

export function WishlistButton({
  productId,
  className,
  size = 16,
  onMedia = false,
}: Props) {
  const [on, setOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [customer, setCustomer] = useState<{ id: string } | null>(null)

  useEffect(() => {
    getSessionCustomer().then(setCustomer)
  }, [])

  useEffect(() => {
    if (!customer) return
    getWishlist()
      .then((res) => setOn(res.products.some((p) => p.id === productId)))
      .catch(() => {})
  }, [customer, productId])

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (loading) return
      if (!customer) {
        window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname)
        return
      }
      setLoading(true)
      try {
        if (on) {
          await removeFromWishlist(productId)
          setOn(false)
        } else {
          await addToWishlist(productId)
          setOn(true)
        }
      } catch {
        /* swallow */
      }
      setLoading(false)
    },
    [customer, loading, on, productId],
  )

  return (
    <button
      type="button"
      aria-label={on ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={on}
      disabled={loading}
      data-product-id={productId}
      onClick={handleClick}
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
        className={cn(on ? "[&_path]:fill-current" : undefined, loading && "opacity-50")}
      />
    </button>
  )
}

export const WishlistHeart = WishlistButton
