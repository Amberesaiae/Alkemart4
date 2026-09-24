/**
 * Removable applied-filter chips.
 *
 * The PLP previously exposed only a blanket "Reset", so a shopper three
 * facets deep could neither see what was applied nor undo one of them
 * without re-opening each panel. Chips make the state legible, which is
 * also what lets the secondary panels collapse by default without anyone
 * losing their place.
 */
import { IconSafe } from "@/design/icons"
import type {
  AppliedFacet,
  ListingFacetState,
} from "@/components/listing/ListingFacets"
import { cn } from "@/lib/utils"

type Props = {
  facets: AppliedFacet[]
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  onClearAll: () => void
  /** Result count after filtering — the feedback that makes facets feel alive. */
  count?: number
  loadingCount?: boolean
  className?: string
}

export function ListingAppliedFacets({
  facets,
  state,
  onChange,
  onClearAll,
  count,
  loadingCount,
  className,
}: Props) {
  if (facets.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 shadow-2xs",
        className,
      )}
      role="region"
      aria-label="Applied filters"
    >
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {!loadingCount && typeof count === "number"
          ? `${count.toLocaleString()} ${count === 1 ? "result" : "results"}`
          : "Filters:"}
      </span>
      <span className="text-xs text-muted-foreground" aria-hidden>
        ·
      </span>

      <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
        {facets.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              onClick={() => onChange(f.clear(state))}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded border border-border/90 bg-muted/60 px-2 text-xs font-medium ",
                "hover:border-destructive hover:bg-destructive/10 hover:text-destructive",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              )}
            >
              <span className="text-muted-foreground">{f.group}:</span>
              <span className="max-w-[10rem] truncate font-semibold text-foreground">
                {f.label}
              </span>
              <IconSafe
                name="close"
                size={11}
                preferAsset={false}
                className="shrink-0 opacity-70"
              />
              <span className="sr-only">
                Remove {f.group} filter {f.label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClearAll}
        className={cn(
          "ms-auto text-xs font-semibold text-primary-strong underline underline-offset-2  hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        )}
      >
        Clear all
      </button>
    </div>
  )
}
