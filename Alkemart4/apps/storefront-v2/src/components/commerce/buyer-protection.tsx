import { HugeiconsIcon } from "@hugeicons/react"
import { SecurityCheckIcon } from "@hugeicons/core-free-icons"
import { useProtection } from "@/lib/protection"
import { cn } from "@/lib/utils"

/**
 * alkemart Buyer Protection, in the buyer's words. Online payments are held
 * until the buyer has the order; faulty or wrong items can be returned for
 * the platform's minimum window (from the admin rule, never hard-coded).
 * `cod` explains honestly that cash isn't held.
 */
export function BuyerProtection({ variant = "line", cod = false, className }: { variant?: "line" | "card"; cod?: boolean; className?: string }) {
  const q = useProtection()
  const days = q.data?.faultReturnDays
  const window = days ? ` Wrong, damaged or not as described? Ask for a refund within ${days} days of delivery.` : ""
  const title = cod ? "Pay on delivery." : "alkemart Buyer Protection."
  const text = cod
    ? "Check your items before you pay the rider — the cash goes straight to the seller. Pay online to be covered by alkemart Buyer Protection."
    : `Pay online and the seller is only paid after you have your order.${window}`
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-sm",
        variant === "card" ? cn("rounded-2xl p-3.5 text-foreground", cod ? "bg-surface" : "bg-success-soft") : "text-muted-foreground",
        className,
      )}
    >
      <HugeiconsIcon icon={SecurityCheckIcon} className={cn("mt-0.5 size-4 shrink-0", cod ? "text-muted-foreground" : "text-success")} aria-hidden />
      <span>
        <span className="font-semibold text-foreground">{title}</span> {text}
      </span>
    </p>
  )
}
