import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"

export type AddToCartVariant = "pill" | "icon"

type Props = {
  variant?: AddToCartVariant
  pending?: boolean
  ok?: boolean
  disabled?: boolean
  onClick: () => void
  /** Demo / unavailable title */
  title?: string
  className?: string
  label?: string
}

/**
 * Mowafer cart CTA:
 *  - pill: yellow “Add To Cart” + cart glyph (hero / feature)
 *  - icon: solid yellow circle cart only (mid / dense tiles)
 */
export function AddToCartControl({
  variant = "icon",
  pending,
  ok,
  disabled,
  onClick,
  title = "Add to cart",
  className,
  label = "Add To Cart",
}: Props) {
  const pill = variant === "pill"

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled || pending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold text-primary-foreground shadow-sm transition",
        "bg-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55",
        pill
          ? "h-9 gap-1.5 rounded-full px-3.5 text-sm sm:h-10 sm:px-4"
          : "min-h-11 min-w-11 h-8 w-8 rounded-full sm:h-9 sm:w-9",
        className,
      )}
    >
      {pending ? (
        <span className="text-sm">…</span>
      ) : ok ? (
        <span className="text-sm">✓</span>
      ) : (
        <>
          {pill ? <span className="whitespace-nowrap">{label}</span> : null}
          <IconSafe name="add-cart" size={pill ? 16 : 15} preferAsset />
        </>
      )}
    </button>
  )
}
