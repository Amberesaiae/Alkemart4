import type { OfferSelection } from "@/lib/offer-selection"
import { cn } from "@/lib/utils"

/**
 * Variant chips. Values no combination offers are hidden; unstocked ones
 * stay visible but struck through so the buyer learns the range exists.
 */
export function OptionPicker({
  options,
  onSelect,
  size = "md",
}: {
  options: OfferSelection["options"]
  onSelect: (name: string, value: string) => void
  size?: "sm" | "md"
}) {
  return (
    <div className="space-y-4">
      {options.map((opt) => {
        const labelId = `opt-${opt.name.replace(/\W+/g, "-")}`
        return (
          <div key={opt.name} className="space-y-2">
            <p id={labelId} className="text-sm text-muted-foreground">
              {opt.name}
              {opt.selectedValue ? (
                <span className="font-semibold text-foreground">: {opt.selectedValue}</span>
              ) : null}
            </p>
            <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
              {opt.values
                .filter((v) => v.exists)
                .map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    data-slot="variant-option"
                    role="radio"
                    aria-checked={v.selected}
                    aria-label={`${opt.name}: ${v.value}${v.buyable ? "" : " (out of stock)"}`}
                    onClick={() => onSelect(opt.name, v.value)}
                    className={cn(
                      "relative inline-flex items-center justify-center gap-2 rounded-2xl border bg-background font-medium transition-colors",
                      size === "md" ? "min-h-11 min-w-16 px-4 text-sm" : "min-h-9 min-w-12 px-3 text-sm md:text-xs",
                      v.selected
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-foreground/40",
                      !v.buyable && "text-muted-foreground line-through decoration-muted-foreground/60",
                    )}
                  >
                    {v.imageUrl ? (
                      <img src={v.imageUrl} alt="" className="size-7 rounded-full object-cover" />
                    ) : null}
                    {v.imageUrl ? <span className="sr-only">{v.value}</span> : v.value}
                  </button>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
