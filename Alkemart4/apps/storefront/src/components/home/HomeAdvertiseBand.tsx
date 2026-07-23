import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  title?: string
  body?: string
  ctaHref?: string
  ctaLabel?: string
  ctaTo?: string
}

/**
 * Sell band — single compact CTA strip (no tall lead-gen form).
 */
export function HomeAdvertiseBand({
  className,
  title = "Sell on alkemart",
  body = "Open a shop and list products for buyers nationwide.",
  ctaHref,
  ctaLabel = "Start selling",
  ctaTo = "/sell",
}: Props) {
  const ctaClass = cn(
    "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full",
    "bg-foreground px-5 text-sm font-bold text-background",
    "transition hover:opacity-90",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
  )

  return (
    <section
      className={cn(
        "home-band home-band-primary relative overflow-hidden rounded-xl px-4 py-5 sm:px-6 sm:py-5",
        className,
      )}
      aria-labelledby="advertise-band-title"
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h2 id="advertise-band-title" className="type-band text-primary-foreground">
            {title}
          </h2>
          <p className="type-sm max-w-xl leading-relaxed text-primary-foreground/90 sm:text-base">
            {body}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {ctaHref ? (
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className={ctaClass}
            >
              {ctaLabel}
            </a>
          ) : (
            <Link to={ctaTo as "/sell"} className={ctaClass}>
              {ctaLabel}
            </Link>
          )}
          <Link
            to="/sell"
            className="type-sm font-bold text-primary-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            How selling works
          </Link>
        </div>
      </div>
    </section>
  )
}
