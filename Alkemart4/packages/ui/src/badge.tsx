import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./cn"

/**
 * Badge — the shared status-label primitive.
 *
 * Two orthogonal axes instead of one muddled `variant` list:
 *   tone     what it means   (neutral · brand · success · warning · danger · info · scarce)
 *   emphasis how loud it is  (solid · soft · outline)
 *
 * Colours come from the generated `--tone-*` ramp in each app's stylesheet,
 * where every text/background pair is verified AA. Two rules that ramp
 * encodes and this component must not undo:
 *
 *   1. Soft backgrounds are OPAQUE tints, never alpha. A `bg-x/10` chip is
 *      invisible over product photography and shifts with whatever is
 *      behind it.
 *   2. Solid fills carry a shadow, because badges sit on images.
 *
 * Sizes stop at 12px on purpose — these are short uppercase labels, not
 * body copy, so they sit below the 14px reading floor deliberately.
 */
const badgeVariants = cva(
  cn(
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md",
    "font-bold uppercase tracking-[0.04em] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ),
  {
    variants: {
      tone: {
        neutral: "",
        brand: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
        scarce: "",
      },
      emphasis: {
        solid: "border border-transparent shadow-sm",
        soft: "border border-transparent",
        outline: "border bg-transparent",
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs leading-[1.1]", // 12px — canonical floor
        md: "px-2 py-1 text-xs leading-[1.1]", // 12px — cards, detail pages
      },
    },
    compoundVariants: [
      // solid — the lightest shade of each hue that still holds its text
      { tone: "neutral", emphasis: "solid", class: "bg-tone-neutral text-tone-neutral-fg" },
      { tone: "brand", emphasis: "solid", class: "bg-tone-brand text-tone-brand-fg" },
      { tone: "success", emphasis: "solid", class: "bg-tone-success text-tone-success-fg" },
      { tone: "warning", emphasis: "solid", class: "bg-tone-warning text-tone-warning-fg" },
      { tone: "danger", emphasis: "solid", class: "bg-tone-danger text-tone-danger-fg" },
      { tone: "info", emphasis: "solid", class: "bg-tone-info text-tone-info-fg" },
      { tone: "scarce", emphasis: "solid", class: "bg-tone-scarce text-tone-scarce-fg" },
      // soft — opaque tint + the hue's AA-safe ink
      { tone: "neutral", emphasis: "soft", class: "bg-tone-neutral-soft text-tone-neutral-ink" },
      { tone: "brand", emphasis: "soft", class: "bg-tone-brand-soft text-tone-brand-ink" },
      { tone: "success", emphasis: "soft", class: "bg-tone-success-soft text-tone-success-ink" },
      { tone: "warning", emphasis: "soft", class: "bg-tone-warning-soft text-tone-warning-ink" },
      { tone: "danger", emphasis: "soft", class: "bg-tone-danger-soft text-tone-danger-ink" },
      { tone: "info", emphasis: "soft", class: "bg-tone-info-soft text-tone-info-ink" },
      { tone: "scarce", emphasis: "soft", class: "bg-tone-scarce-soft text-tone-scarce-ink" },
      // outline — ink on the page, hairline in the hue
      { tone: "neutral", emphasis: "outline", class: "border-tone-neutral-ink text-tone-neutral-ink" },
      { tone: "brand", emphasis: "outline", class: "border-tone-brand-ink text-tone-brand-ink" },
      { tone: "success", emphasis: "outline", class: "border-tone-success-ink text-tone-success-ink" },
      { tone: "warning", emphasis: "outline", class: "border-tone-warning-ink text-tone-warning-ink" },
      { tone: "danger", emphasis: "outline", class: "border-tone-danger-ink text-tone-danger-ink" },
      { tone: "info", emphasis: "outline", class: "border-tone-info-ink text-tone-info-ink" },
      { tone: "scarce", emphasis: "outline", class: "border-tone-scarce-ink text-tone-scarce-ink" },
    ],
    defaultVariants: { tone: "neutral", emphasis: "soft", size: "md" },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>
export type BadgeEmphasis = NonNullable<
  VariantProps<typeof badgeVariants>["emphasis"]
>

/**
 * Legacy `variant` names, kept so existing call sites keep working.
 * Prefer `tone` + `emphasis` in new code.
 * @deprecated
 */
const LEGACY: Record<string, { tone: BadgeTone; emphasis: BadgeEmphasis }> = {
  default: { tone: "brand", emphasis: "solid" },
  secondary: { tone: "neutral", emphasis: "soft" },
  destructive: { tone: "danger", emphasis: "solid" },
  outline: { tone: "neutral", emphasis: "outline" },
  success: { tone: "success", emphasis: "soft" },
  warning: { tone: "warning", emphasis: "soft" },
  info: { tone: "info", emphasis: "soft" },
}

export type BadgeVariant = keyof typeof LEGACY

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    Omit<VariantProps<typeof badgeVariants>, "tone" | "emphasis"> {
  tone?: BadgeTone
  emphasis?: BadgeEmphasis
  /** @deprecated use `tone` + `emphasis` */
  variant?: BadgeVariant
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, emphasis, size, variant, ...props }, ref) => {
    const legacy = variant ? LEGACY[variant] : undefined
    return (
      <span
        ref={ref}
        className={cn(
          badgeVariants({
            tone: tone ?? legacy?.tone,
            emphasis: emphasis ?? legacy?.emphasis,
            size,
          }),
          className,
        )}
        {...props}
      />
    )
  },
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
