import { cn } from "@/lib/utils"

export type CheckoutStepId = "address" | "delivery" | "payment" | "done"

const STEPS: { id: CheckoutStepId; label: string; icon: string }[] = [
  { id: "address", label: "Address", icon: "1" },
  { id: "delivery", label: "Delivery", icon: "2" },
  { id: "payment", label: "Payment", icon: "3" },
  { id: "done", label: "Done", icon: "✓" },
]

type Props = {
  current: CheckoutStepId
  className?: string
}

/**
 * Mowafer-style linear checkout stepper.
 */
export function CheckoutStepper({ current, className }: Props) {
  const idx = STEPS.findIndex((s) => s.id === current)
  const active = idx < 0 ? 0 : idx

  return (
    <ol
      className={cn(
        "flex items-center justify-between gap-1 sm:gap-2",
        className,
      )}
      aria-label="Checkout progress"
    >
      {STEPS.map((step, i) => {
        const done = i < active
        const isCurrent = i === active
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9",
                  done || isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {step.icon}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-semibold",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={cn(
                  "mb-4 h-0.5 min-w-[0.5rem] flex-1",
                  i < active ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
