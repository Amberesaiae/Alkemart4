import { Check } from "@phosphor-icons/react"
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
 * Cart CTA:
 *  - pill: gold “Add To Cart” + cart glyph
 *  - icon: gold circle with + on product art (Hubtel-smooth tile)
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
        "inline-flex shrink-0 items-center justify-center font-bold shadow-sm transition-all",
        pill
          ? "h-9 gap-1.5 rounded-full bg-primary px-3.5 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 sm:h-10 sm:px-4"
          : "h-8 w-8 rounded-[8px] bg-primary text-primary-foreground shadow-xs hover:opacity-90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
    >
      {pending ? (
        <span className="text-sm">…</span>
      ) : ok ? (
        <Check size={14} weight="bold" aria-hidden />
      ) : (
        <>
          {pill ? (
            <>
              <span className="whitespace-nowrap">{label}</span>
              <IconSafe name="add-cart" size={16} preferAsset />
            </>
          ) : (
            <svg viewBox="0 0 12 12" className="size-3.5" aria-hidden>
              <path
                d="M6 1.75v8.5M1.75 6h8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </>
      )}
    </button>
  )
}
