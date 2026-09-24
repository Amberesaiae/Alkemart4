import { GHANA_MAJOR_CITIES, GHANA_REGIONS } from "@/lib/ghana-locale"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui"

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
/** Sentinel: Radix items need non-empty values; maps back to null. */
const ALL = "__all"

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
        <div className="space-y-1">
          <span id="location-region-label" className="mb-1 block type-sm text-muted-foreground">
            Region
          </span>
          <Select
            value={value.province ?? ALL}
            onValueChange={(v) => onChange({ province: v === ALL ? null : v, city: value.city })}
          >
            <SelectTrigger aria-labelledby="location-region-label" className="h-10 rounded-lg type-sm font-medium">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All regions</SelectItem>
              {GHANA_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span id="location-city-label" className="mb-1 block type-sm text-muted-foreground">
            City
          </span>
          <Select
            value={value.city ?? ALL}
            onValueChange={(v) => onChange({ province: value.province, city: v === ALL ? null : v })}
          >
            <SelectTrigger aria-labelledby="location-city-label" className="h-10 rounded-lg type-sm font-medium">
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All cities</SelectItem>
              {GHANA_MAJOR_CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  )
}
