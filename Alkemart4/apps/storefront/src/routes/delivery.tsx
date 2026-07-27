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

      <div className="delivery-page mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:py-14">
        {/* Hero band */}
        <section
          className="glass-card rounded-xl px-4 py-6 shadow-[inset_0_0_0_1px_color-mix(in_srgb,_var(--primary)_12%,_transparent)] sm:px-8 sm:py-8"
          aria-labelledby="delivery-hero-title"
        >
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-8 sm:text-left">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 size-20 sm:size-32",
              )}
              aria-hidden="true"
            >
              <img
                src={deliveryArt}
                alt=""
                width={128}
                height={128}
                className="size-14 object-contain opacity-95 sm:size-24"
                decoding="async"
                loading="eager"
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <h1
                id="delivery-hero-title"
                className="text-xl font-extrabold leading-snug tracking-tight sm:type-hero-sm"
              >
                Delivery{" "}
                <span className="text-primary">across Ghana</span>
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-white/55 sm:text-base">
                Cash on delivery. Riders bring orders to your door —{" "}
                no credit card, no upfront payment. Delivery fees are set by
                each seller and shown at checkout.
              </p>
              <Link
                to="/categories/$slug"
                params={{ slug: "all" }}
                className={cn(
                  "inline-flex items-center rounded-full bg-primary font-bold text-primary-foreground",
                  "mt-2 h-10 min-h-10 px-5 text-sm",
                  "transition hover:opacity-90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
                )}
              >
                Start shopping
              </Link>
            </div>
          </div>
        </section>

        {/* How delivery works */}
        <section className="mt-8 space-y-4 sm:mt-12 sm:space-y-6">
          <h2 className="type-section text-primary">
            How delivery works
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {DELIVERY_STEPS.map((step, i) => (
              <div
                key={step.title}
                className={cn(
                  "flex flex-col gap-3 rounded-xl p-4 sm:gap-4 sm:p-5",
                  "glass-card",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full bg-primary font-extrabold text-primary-foreground",
                    "sm:size-10 sm:text-base text-sm",
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold sm:text-base">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-white/50 sm:text-sm">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Delivery methods */}
        <section className="mt-8 space-y-4 sm:mt-12 sm:space-y-6">
          <h2 className="type-section text-primary">
            Delivery methods
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div
              className={cn(
                "flex items-start gap-4 rounded-xl p-4 sm:p-5",
                "glass-card",
              )}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg",
                  "bg-primary/10 size-14 sm:size-20",
                )}
                aria-hidden="true"
              >
                <img
                  src={codArt}
                  alt=""
                  width={80}
                  height={80}
                  className="size-10 object-contain sm:size-14"
                  decoding="async"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-bold sm:text-base">
                  Cash on delivery
                </h3>
                <p className="text-xs leading-relaxed text-white/50 sm:text-sm">
                  Pay cash when the rider arrives. No cards, no sign-up
                  needed. Available for most sellers across Ghana.
                </p>
              </div>
            </div>
            <div
              className={cn(
                "flex items-start gap-4 rounded-xl p-4 sm:p-5",
                "glass-card",
              )}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg",
                  "bg-primary/10 size-14 sm:size-20",
                )}
                aria-hidden="true"
              >
                <img
                  src={doorstepArt}
                  alt=""
                  width={80}
                  height={80}
                  className="size-10 object-contain sm:size-14"
                  decoding="async"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-bold sm:text-base">
                  Doorstep delivery
                </h3>
                <p className="text-xs leading-relaxed text-white/50 sm:text-sm">
                  Delivered to your address — home, work, or a pickup
                  location you choose. Each seller sets their delivery area
                  and fee.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery areas */}
        <section className="mt-8 space-y-3 sm:mt-12 sm:space-y-4">
          <h2 className="type-section text-primary">
            Delivery areas
          </h2>
          <div
            className={cn(
              "rounded-xl p-4 sm:p-6",
              "glass-card",
            )}
          >
            <p className="text-sm leading-relaxed text-white/50">
              Sellers on alkemart operate across Ghana. Each seller sets
              their own delivery areas and fees. You'll see accurate
              delivery options when you enter your address at checkout.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-8 sm:mt-12">
          <div
            className={cn(
              "rounded-xl px-4 py-6 text-center sm:px-8 sm:py-8",
              "bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_srgb,_var(--primary)_20%,_transparent)]",
            )}
          >
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
              Ready to shop?
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55 sm:text-base">
              Browse categories, compare sellers, and pay on delivery.
            </p>
            <Link
              to="/categories/$slug"
              params={{ slug: "all" }}
              className={cn(
                "mt-4 inline-flex items-center rounded-full bg-primary font-bold text-primary-foreground",
                "h-11 min-h-11 px-6 text-sm",
                "transition hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
              )}
            >
              Browse all
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
