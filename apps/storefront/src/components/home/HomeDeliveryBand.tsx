import { Link } from "@tanstack/react-router"
import deliveryArt from "@/assets/illustrations/ecommerce-delivery-service.png"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  title?: string
  titleAccent?: string
  body?: string
  ctaLabel?: string
}

/**
 * Delivery band — compact two-column strip (not a full-page hero).
 */
export function HomeDeliveryBand({
  className,
  title = "Delivery",
  titleAccent = "across Ghana",
  body = "Cash on delivery. Options confirmed at checkout.",
  ctaLabel = "Shop",
}: Props) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl bg-foreground px-5 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <div className="relative grid items-center gap-5 sm:grid-cols-[1fr_auto] sm:gap-8">
        <div className="max-w-lg space-y-3">
          <h2 className="type-band text-background">
            {title}{" "}
            <span className="relative inline-block whitespace-nowrap text-primary">
              {titleAccent}
              <span
                className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-primary/60"
                aria-hidden
              />
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-background/70 sm:text-base">
            {body}
          </p>
          <Link
            to="/categories/$slug"
            params={{ slug: "all" }}
            className="inline-flex rounded-full bg-primary px-5 py-2 text-sm font-bold text-foreground transition hover:opacity-90"
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="mx-auto flex shrink-0 items-center justify-center sm:mx-0">
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-white/10 sm:h-36 sm:w-36 lg:h-40 lg:w-40">
            <img
              src={deliveryArt}
              alt=""
              width={200}
              height={200}
              className="h-24 w-24 object-contain opacity-90 sm:h-28 sm:w-28 lg:h-32 lg:w-32"
              decoding="async"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
