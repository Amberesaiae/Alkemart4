import { GHANA_MAJOR_CITIES, GHANA_REGIONS } from "@/lib/ghana-locale"
import { cn } from "@/lib/utils"

export type LocationFilterValue = {
  /** Ghana administrative region, e.g. "Greater Accra" */
  province: string | null
  /** City/town, e.g. "Accra" */
  city: string | null
}

type Props = {
  value: LocationFilterValue
  onChange: (next: LocationFilterValue) => void
  /**
   * When false, controls stay visible but disabled with honest copy.
   * Set true only when search facetDistribution includes location attributes
   * or backend has confirmed location index.
   */
  enabled?: boolean
  className?: string
}

/**
 * Ghana location discovery filter (Mowafer PLP strip extension).
 * Backend-first: filters map to search `seller_province` / `seller_city`.
 * Never invents geo matches when index is empty — disable + explain.
 */
export function ListingLocationFilter({
  value,
  onChange,
  enabled = false,
  className,
}: Props) {
  return (
    <fieldset
      className={cn("min-w-0 space-y-2", className)}
      disabled={!enabled}
    >
      <legend className="type-sm font-bold text-foreground">
        Location
      </legend>
      {!enabled ? (
        <p className="type-sm leading-snug text-muted-foreground">
          Coming soon — when sellers set delivery areas.
        </p>
      ) : null}
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block type-sm text-muted-foreground">
            Region
          </span>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 type-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            value={value.province ?? ""}
            aria-label="Filter by region"
            onChange={(e) =>
              onChange({
                province: e.target.value || null,
                city: value.city,
              })
            }
          >
            <option value="">All regions</option>
            {GHANA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block type-sm text-muted-foreground">
            City
          </span>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 type-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            value={value.city ?? ""}
            aria-label="Filter by city"
            onChange={(e) =>
              onChange({
                province: value.province,
                city: e.target.value || null,
              })
            }
          >
            <option value="">All cities</option>
            {GHANA_MAJOR_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  )
}
