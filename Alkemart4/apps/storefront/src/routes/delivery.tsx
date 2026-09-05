import { createFileRoute, Link } from "@tanstack/react-router"
import { PageSeo } from "@/components/page-seo"
import deliveryArt from "@/assets/illustrations/ecommerce-delivery-service.png"
import doorstepArt from "@/assets/illustrations/doorstep-delivery.png"
import codArt from "@/assets/illustrations/cash-on-delivery.png"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/delivery")({
  component: DeliveryPage,
})

const DELIVERY_STEPS = [
  {
    title: "Browse & order",
    body: "Pick from sellers across Ghana. Prices shown include the seller's delivery fee.",
  },
  {
    title: "Seller prepares",
    body: "The seller packs your item and confirms readiness. Most sellers ship within 1-3 business days.",
  },
  {
    title: "Rider delivers",
    body: "Local riders or seller's delivery team brings your order to your door — or a pickup point near you.",
  },
  {
    title: "Pay on arrival",
    body: "Cash on delivery. Hand cash to the rider when your order arrives. No upfront payment needed.",
  },
]

function DeliveryPage() {
  return (
    <>
      <PageSeo
        title="Delivery"
        description="alkemart delivery — cash on delivery across Ghana. Learn how delivery works, what areas we serve, and what it costs."
        path="/delivery"
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:py-12 space-y-8">
        {/* Hero band */}
        <section
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
          aria-labelledby="delivery-hero-title"
        >
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl",
                "bg-primary/10 size-20 sm:size-28",
              )}
              aria-hidden="true"
            >
              <img
                src={deliveryArt}
                alt=""
                width={128}
                height={128}
                className="size-14 object-contain opacity-95 sm:size-20"
                decoding="async"
                loading="eager"
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Customer Delivery
              </p>
              <h1
                id="delivery-hero-title"
                className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              >
                Delivery across Ghana
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Cash on delivery. Riders bring orders directly to your door —
                no credit card or upfront payment needed. Delivery fees are set by
                each seller and shown transparently at checkout.
              </p>
              <div className="pt-2">
                <Link
                  to="/categories/$slug"
                  params={{ slug: "all" }}
                  className={cn(
                    "inline-flex items-center rounded-lg bg-primary font-bold text-primary-foreground",
                    "h-11 px-6 text-sm",
                    "transition hover:opacity-90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  )}
                >
                  Start shopping
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* How delivery works */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            How delivery works
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DELIVERY_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <span
                  className="flex size-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Delivery methods */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Delivery methods
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div
                className="flex shrink-0 items-center justify-center rounded-xl bg-primary/10 size-14 sm:size-16"
                aria-hidden="true"
              >
                <img
                  src={codArt}
                  alt=""
                  width={80}
                  height={80}
                  className="size-10 object-contain sm:size-12"
                  decoding="async"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Cash on delivery
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Pay cash when the rider arrives. No cards, no sign-up
                  needed. Available for most sellers across Ghana.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div
                className="flex shrink-0 items-center justify-center rounded-xl bg-primary/10 size-14 sm:size-16"
                aria-hidden="true"
              >
                <img
                  src={doorstepArt}
                  alt=""
                  width={80}
                  height={80}
                  className="size-10 object-contain sm:size-12"
                  decoding="async"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Doorstep delivery
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Delivered to your address — home, work, or a pickup
                  location you choose. Each seller sets their delivery area
                  and fee.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery areas */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Delivery areas
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sellers on alkemart operate across Greater Accra, Kumasi, Takoradi, and other major regions in Ghana. Each seller sets
              their own delivery areas and fees. You'll see accurate
              delivery options when you enter your address at checkout.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-border bg-primary/10 p-6 text-center sm:p-8">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Ready to shop?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Browse categories, compare sellers, and pay safely on delivery.
          </p>
          <div className="mt-4">
            <Link
              to="/categories/$slug"
              params={{ slug: "all" }}
              className={cn(
                "inline-flex items-center rounded-lg bg-primary font-bold text-primary-foreground",
                "h-11 px-6 text-sm",
                "transition hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              )}
            >
              Browse all products
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
