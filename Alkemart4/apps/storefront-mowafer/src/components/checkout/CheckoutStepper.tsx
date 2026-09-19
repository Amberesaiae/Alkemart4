import { Check, CreditCard, MapPin, Rocket } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export type CheckoutStepId = "address" | "delivery" | "payment" | "success"

const STEPS: { id: CheckoutStepId; label: string; Icon: typeof MapPin }[] = [
  { id: "address", label: "Address", Icon: MapPin },
  { id: "delivery", label: "Delivery", Icon: Rocket },
  { id: "payment", label: "Payment", Icon: CreditCard },
  { id: "success", label: "Done", Icon: Check },
]

export function CheckoutStepper({ current, className }: { current: CheckoutStepId; className?: string }) {
  const idx = STEPS.findIndex((s) => s.id === current)
  const active = idx < 0 ? 0 : idx

  return (
    <ol className={cn("flex items-center justify-between gap-1 sm:gap-2", className)} aria-label="Checkout steps">
      {STEPS.map((step, i) => {
        const done = i < active
        const isCurrent = i === active
        const Icon = step.Icon
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex min-w-0 flex-col items-center gap-1">
              <span
                data-testid={`step-mark-${step.id}`}
                data-current={isCurrent ? "true" : "false"}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-xs font-bold",
                  isCurrent || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <Icon size={16} weight="bold" aria-hidden />
              </span>
              <span className={cn("truncate text-xs font-semibold", isCurrent ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div className={cn("mb-4 h-0.5 min-w-[0.5rem] flex-1", i < active ? "bg-primary" : "bg-border")} aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
