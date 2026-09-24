import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type Props = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  shownCount?: number
  totalCount?: number
  className?: string
}

/**
 * Jumia-style standard numbered pagination:
 * [<] [1] [2] [3] [4] [5] [>]
 * Clean rectangular geometry (rounded), active page highlighting.
 */
export function ListingPagination({
  currentPage,
  totalPages,
  onPageChange,
  shownCount,
  totalCount,
  className,
}: Props) {
  if (totalPages <= 1) return null

  // Generate page numbers to show around current page
  const pages: (number | "ellipsis")[] = []
  const maxButtons = 5

  if (totalPages <= maxButtons + 2) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    if (start > 2) {
      pages.push("ellipsis")
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (end < totalPages - 1) {
      pages.push("ellipsis")
    }

    pages.push(totalPages)
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 pt-6 sm:flex-row sm:justify-between",
        className,
      )}
      role="navigation"
      aria-label="Pagination"
    >
      {typeof shownCount === "number" && typeof totalCount === "number" ? (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{shownCount}</span> of{" "}
          <span className="font-semibold text-foreground">{totalCount}</span> items
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded border border-border/80 bg-card text-foreground  hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <CaretLeft size={14} weight="bold" />
        </button>

        {pages.map((p, idx) => {
          if (p === "ellipsis") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            )
          }

          const isActive = p === currentPage

          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-xs font-semibold  focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActive
                  ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                  : "border border-border/80 bg-card text-foreground hover:bg-muted",
              )}
            >
              {p}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded border border-border/80 bg-card text-foreground  hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}
