import { Link } from "@tanstack/react-router"
import { Truck } from "@phosphor-icons/react"
import { Button } from "@workspace/ui"
import { cn } from "@/lib/utils"
import { getMarketCountry } from "@/design/market"

export function DeliveryBand({ className }: { className?: string }) {
  const country = getMarketCountry()
  return (
    <section
      data-testid="section-delivery"
      className={cn(
        "relative overflow-hidden rounded-2xl bg-foreground px-6 py-8 text-white sm:px-10 sm:py-10",
        className,
      )}
    >
      <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto] sm:gap-8">
        <div className="max-w-lg space-y-3">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Delivery <span className="text-primary">across {country}</span>
          </h2>
          <p className="text-sm leading-relaxed text-white/75 sm:text-base">
            Cash on delivery. Options confirmed at checkout — we do not invent arrival minutes.
          </p>
          <Button className="rounded-full" asChild>
            <Link to="/categories/$slug" params={{ slug: "all" }}>
              Shop Now
            </Link>
          </Button>
        </div>
        <div className="mx-auto flex size-32 items-center justify-center rounded-2xl bg-white/10 sm:mx-0 sm:size-36">
          <Truck size={64} className="text-primary" aria-hidden />
        </div>
      </div>
    </section>
  )
}
