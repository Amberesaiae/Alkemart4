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
 * Delivery band — mobile: single compact row (art | copy + CTA).
 * sm+: slightly roomier two-column strip.
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
        "home-band home-band-dark relative overflow-hidden rounded-xl",
        "px-3 py-3 sm:px-6 sm:py-5",
        className,
      )}
      aria-labelledby="delivery-band-title"
    >
      <div className="relative flex items-center gap-3 sm:gap-6">
        {/* Art — small on mobile so it sits inline, not a second stack */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-white/10",
            "size-14 sm:size-28 sm:rounded-xl",
          )}
          aria-hidden="true"
        >
          <img
            src={deliveryArt}
            alt=""
            width={112}
            height={112}
            className="size-10 object-contain opacity-90 sm:size-20"
            decoding="async"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1 sm:max-w-lg sm:space-y-2.5">
          <h2
            id="delivery-band-title"
            className="text-base font-extrabold leading-snug tracking-tight text-background sm:type-band"
          >
            {title}{" "}
            <span className="text-primary">{titleAccent}</span>
          </h2>
          <p className="text-xs leading-snug text-background/75 sm:type-sm sm:text-base sm:leading-relaxed">
            {body}
          </p>
          <Link
            to="/categories/$slug"
            params={{ slug: "all" }}
            className={cn(
              "inline-flex items-center rounded-full bg-primary font-bold text-primary-foreground",
              "mt-1 h-9 min-h-9 px-3.5 text-xs",
              "sm:mt-0 sm:h-11 sm:min-h-11 sm:px-5 sm:text-sm",
              "transition hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground",
            )}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}
