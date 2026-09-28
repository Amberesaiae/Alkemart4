import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  DeliveryTruck01Icon,
  SecurityValidationIcon,
  Store04Icon,
  Wallet01Icon,
  Globe02Icon,
  CrownIcon,
} from "@hugeicons/core-free-icons"
import { getActiveMarket } from "@/lib/market"
import { cn } from "@/lib/utils"
const HOME_TRUST_ICONS: IconSvgElement[] = [SecurityValidationIcon, DeliveryTruck01Icon, Globe02Icon, CrownIcon]

type Item = { icon: IconSvgElement; title: string; body: string }

/** Marketplace promises — each maps to a real platform behaviour. */
function items(): Item[] {
  const m = getActiveMarket()
  const pays = [
    m.paymentMethods.includes("cod") ? "on delivery" : null,
    m.paymentMethods.includes("momo") ? "mobile money" : null,
    m.paymentMethods.includes("card") ? "card" : null,
  ].filter(Boolean)
  return [
    { icon: Store04Icon, title: "Many sellers", body: "Independent shops, one place" },
    { icon: Wallet01Icon, title: "Pay your way", body: `Pay ${pays.join(", ")}` },
    { icon: DeliveryTruck01Icon, title: "Delivery shown upfront", body: "Every seller quotes before you pay" },
    { icon: SecurityValidationIcon, title: "Verified shops", body: "Badges name exactly what was checked" },
  ]
}

/** Home: one white panel that overlaps the bottom of the gold hero. */
export function TrustPanel() {
  return (
    <div className="relative z-10 -mt-8 rounded-t-[2rem] bg-background pt-4 sm:-mt-12 sm:pt-5">
      <ul className="container-page grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-y-4 lg:grid-cols-4 lg:divide-x lg:divide-border">
        {items().map((it, index) => (
          <li key={it.title} className="flex items-center gap-2 sm:gap-3 lg:px-6 lg:first:pl-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground sm:size-11 md:size-14">
              <HugeiconsIcon icon={it.icon} className="size-4 sm:size-5 md:hidden" />
              <HugeiconsIcon icon={HOME_TRUST_ICONS[index]} className="hidden size-6 md:block" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-tight font-semibold sm:text-sm">{it.title}</span>
              <span className="mt-0.5 hidden text-[length:var(--text-legacy-13)] text-muted-foreground sm:block">{it.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TrustStrip({ className }: { className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {items().map((it) => (
        <li key={it.title} className="flex items-center gap-3 rounded-2xl bg-surface p-3 sm:p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
            <HugeiconsIcon icon={it.icon} className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-semibold">{it.title}</span>
            <span className="mt-0.5 hidden text-[length:var(--text-legacy-13)] text-muted-foreground sm:block">{it.body}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
