import { color } from "@/design/tokens"
import { cn } from "@/lib/utils"

type Props = {
  /** 0–5, supports halves (e.g. 4.5) */
  value?: number
  max?: number
  size?: number
  className?: string
  label?: string
}

/**
 * Mowafer imgi_10 star row — solid gold stars under title/description.
 * Inline SVG (not IconSafe/assets) so ratings always render correctly.
 * Used on hero, feature, and mid-row cards.
 */
export function ProductRating({
  value = 5,
  max = 5,
  size = 14,
  className,
  label,
}: Props) {
  const clamped = Math.max(0, Math.min(max, value))

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={label ?? `${clamped} out of ${max} stars`}
    >
      {Array.from({ length: max }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return <Star key={i} size={size} fill={fill} />
      })}
    </div>
  )
}

function Star({ size, fill }: { size: number; fill: number }) {
  const id = `star-clip-${Math.round(fill * 100)}-${size}`
  // full
  if (fill >= 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="inline-block shrink-0"
        aria-hidden
      >
        <path
          d={STAR_PATH}
          fill={color.primary}
          stroke="none"
        />
      </svg>
    )
  }
  // empty
  if (fill <= 0) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="inline-block shrink-0"
        aria-hidden
      >
        <path
          d={STAR_PATH}
          fill="none"
          stroke={color.primary}
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity={0.35}
        />
      </svg>
    )
  }
  // half
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="inline-block shrink-0"
      aria-hidden
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={12 * fill * 2} height="24" />
        </clipPath>
      </defs>
      <path
        d={STAR_PATH}
        fill="none"
        stroke={color.primary}
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity={0.35}
      />
      <path
        d={STAR_PATH}
        fill={color.primary}
        stroke="none"
        clipPath={`url(#${id})`}
      />
    </svg>
  )
}

const STAR_PATH =
  "M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
