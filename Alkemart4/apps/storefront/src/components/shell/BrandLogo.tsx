import { Link } from "@tanstack/react-router"
import { brand } from "@/design/brand"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  size?: "sm" | "md" | "lg"
  linked?: boolean
  label?: string
  /**
   * Dark surfaces (footer): white wordmark + gold period.
   * Do not use CSS invert — that washes the brand period to white.
   */
  onDark?: boolean
}

/** Text-only alkemart wordmark: alkemart + gold period. */
export function BrandLogo({
  className,
  size = "md",
  linked = true,
  label = brand.name,
  onDark = false,
}: Props) {
  const typeClass =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : size === "sm"
        ? "text-lg"
        : "text-xl sm:text-2xl"

  const wordmark = (
    <span
      className={cn(
        "brand-wordmark font-extrabold leading-none",
        typeClass,
        onDark ? "text-white" : "text-foreground",
      )}
    >
      {brand.wordmarkHtml}
      <span className="brand-period" aria-hidden>
        .
      </span>
    </span>
  )

  if (!linked) {
    return (
      <span className={cn("inline-flex items-center", className)} aria-label={label}>
        {wordmark}
      </span>
    )
  }

  return (
    <Link
      to="/"
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label={`${label} home`}
    >
      {wordmark}
    </Link>
  )
}
