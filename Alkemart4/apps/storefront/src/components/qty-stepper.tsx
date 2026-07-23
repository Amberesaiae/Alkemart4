import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type QtyStepperProps = {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  size?: "sm" | "md"
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
  className,
  size = "md",
}: QtyStepperProps) {
  const btn = size === "sm" ? "min-h-9 min-w-9 h-9 w-9" : "min-h-11 min-w-11"
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={btn}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </Button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={btn}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </Button>
    </div>
  )
}
