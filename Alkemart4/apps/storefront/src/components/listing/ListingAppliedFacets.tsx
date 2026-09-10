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
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5",
        className,
      )}
      role="region"
      aria-label="Applied filters"
    >
      <span className="type-sm font-semibold text-foreground">
        {!loadingCount && typeof count === "number"
          ? `${count} result${count === 1 ? "" : "s"}`
          : "Filtered"}
      </span>
      <span className="type-sm text-muted-foreground" aria-hidden>
        ·
      </span>

      <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
        {facets.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              onClick={() => onChange(f.clear(state))}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background py-1 ps-2.5 pe-2 type-sm transition",
                "hover:border-primary-strong hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              )}
            >
              <span className="text-muted-foreground">{f.group}</span>
              <span className="max-w-[12rem] truncate font-semibold text-foreground">
                {f.label}
              </span>
              <IconSafe
                name="close"
                size={12}
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
          "ms-auto min-h-9 shrink-0 rounded-full px-2.5 type-sm font-semibold text-foreground underline underline-offset-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        )}
      >
        Clear all
      </button>
    </div>
  )
}
