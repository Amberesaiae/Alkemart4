import {
  Label,
  RadioGroup,
  RadioGroupItem,
  Slider,
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui"
import { SquaresFour, List } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export type ListingViewMode = "grid" | "list"

export type ListingFacetState = {
  subCategory: string
  minRating: number
  priceMin: number
  priceMax: number
}

type Props = {
  departmentLabel: string
  subCategories?: { id: string; label: string }[]
  ratingAvailable?: boolean
  priceBounds: { min: number; max: number }
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  viewMode: ListingViewMode
  onViewModeChange: (mode: ListingViewMode) => void
  className?: string
}

export function ListingFilterStrip({
  departmentLabel,
  subCategories = [],
  ratingAvailable = false,
  priceBounds,
  state,
  onChange,
  viewMode,
  onViewModeChange,
  className,
}: Props) {
  const span = Math.max(priceBounds.max - priceBounds.min, 1)

  return (
    <div
      className={cn(
        "grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      role="region"
      aria-label="Listing filters"
    >
      {subCategories.length > 0 ? (
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-sm font-semibold">{departmentLabel}</legend>
          <RadioGroup
            value={state.subCategory}
            onValueChange={(v) => onChange({ ...state, subCategory: v })}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="sub-all" />
              <Label htmlFor="sub-all">All</Label>
            </div>
            {subCategories.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2">
                <RadioGroupItem value={sub.id} id={`sub-${sub.id}`} />
                <Label htmlFor={`sub-${sub.id}`}>{sub.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      ) : null}

      {ratingAvailable ? (
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-sm font-semibold">Average rating</legend>
          <RadioGroup
            value={String(state.minRating)}
            onValueChange={(v) => onChange({ ...state, minRating: Number(v) })}
          >
            {[0, 4, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <RadioGroupItem value={String(n)} id={`rating-${n}`} />
                <Label htmlFor={`rating-${n}`}>{n === 0 ? "Any" : `${n}+`}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      ) : null}

      <fieldset className="min-w-0 space-y-3">
        <legend className="text-sm font-semibold">Price</legend>
        <Slider
          min={priceBounds.min}
          max={priceBounds.max}
          step={Math.max(1, Math.round(span / 40))}
          minStepsBetweenThumbs={1}
          value={[state.priceMin, state.priceMax]}
          onValueChange={([min, max]) =>
            onChange({ ...state, priceMin: min ?? priceBounds.min, priceMax: max ?? priceBounds.max })
          }
        />
        <p className="text-xs text-muted-foreground">
          GH₵{state.priceMin} – GH₵{state.priceMax}
        </p>
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-semibold">View</legend>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && onViewModeChange(v as ListingViewMode)}
          variant="outline"
        >
          <ToggleGroupItem value="grid" aria-label="Grid">
            <SquaresFour size={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List">
            <List size={16} />
          </ToggleGroupItem>
        </ToggleGroup>
      </fieldset>
    </div>
  )
}
