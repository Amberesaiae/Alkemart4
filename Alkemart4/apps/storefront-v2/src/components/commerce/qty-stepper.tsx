import { HugeiconsIcon } from "@hugeicons/react"
import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  size = "md",
  className,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number | null
  disabled?: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const btn = cn(
    "grid place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40",
    size === "md" ? "size-10" : "size-8",
  )
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background",
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        aria-label="Decrease quantity"
      >
        <HugeiconsIcon icon={MinusSignIcon} className="size-4" />
      </button>
      <span
        className={cn("text-center font-semibold tabular", size === "md" ? "w-8 text-sm" : "w-6 text-xs")}
        aria-live="polite"
        aria-label={`Quantity ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        disabled={disabled || (max != null && value >= max)}
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
      </button>
    </div>
  )
}
