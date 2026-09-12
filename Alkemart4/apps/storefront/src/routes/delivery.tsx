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
    body: "Pick from sellers across Ghana — fees show at checkout.",
  },
  {
    title: "Seller prepares",
    body: "Sellers pack and ship, usually within 1–3 business days.",
  },
  {
    title: "Rider delivers",
    body: "Riders deliver to your door or a nearby pickup point.",
  },
  {
    title: "Pay on arrival",
    body: "Hand cash to the rider. Nothing to pay upfront.",
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
                "bg-muted size-20 sm:size-28",
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
                Pay cash when your order arrives. Each seller sets their own
                delivery fee — shown at checkout.
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
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/25"
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
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/25">
              <div
                className="flex shrink-0 items-center justify-center rounded-xl bg-muted size-14 sm:size-16"
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
                  Pay cash at your door. No cards, no sign-up.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/25">
              <div
                className="flex shrink-0 items-center justify-center rounded-xl bg-muted size-14 sm:size-16"
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
                  Home, work, or a pickup point — areas and fees vary by seller.
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
              Sellers cover Greater Accra, Kumasi, Takoradi and beyond.
              Exact options appear once you enter your address at checkout.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-border bg-muted p-6 text-center sm:p-8">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Ready to shop?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Compare sellers and pay on delivery.
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
