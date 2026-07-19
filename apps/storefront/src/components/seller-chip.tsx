import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

export type SellerRef = {
  id?: string | null
  name?: string | null
  handle?: string | null
}

type SellerChipProps = {
  seller?: SellerRef | null
  className?: string
  /** Compact: "by Name" instead of "Sold by Name" */
  short?: boolean
}

/**
 * Multivendor trust line — only renders when API provided a seller name.
 * Never invents "Unknown seller" as a fake brand.
 */
export function SellerChip({ seller, className, short }: SellerChipProps) {
  const name = seller?.name?.trim()
  if (!name) return null

  const handle = seller?.handle?.trim()
  const content = (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {short ? "by " : "Sold by "}
      <span className="font-medium text-foreground">{name}</span>
    </span>
  )

  if (handle) {
    return (
      <Link
        to="/shops/$slug"
        params={{ slug: handle }}
        className="hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </Link>
    )
  }

  return content
}
