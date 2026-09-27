import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/** Average + count. Renders nothing when there are no ratings — never "0.0". */
export function Rating({
  avg,
  count,
  className,
  showCount = true,
}: {
  avg: number | null | undefined
  count?: number | null
  className?: string
  showCount?: boolean
}) {
  if (avg == null || !count) return null
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground tabular", className)}
      aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
    >
      <HugeiconsIcon icon={StarIcon} className="size-3.5 fill-star text-star" aria-hidden />
      <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>
      {showCount ? <span>({count.toLocaleString()})</span> : null}
    </span>
  )
}

/** Five-star row for review lists. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <HugeiconsIcon
          key={i}
          icon={StarIcon}
          aria-hidden
          className={cn("size-3.5", i <= Math.round(value) ? "fill-star text-star" : "text-border")}
        />
      ))}
    </span>
  )
}
