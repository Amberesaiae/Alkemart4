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
 * Advertise band — compact yellow strip (aligned height with delivery band).
 */
export function HomeAdvertiseBand({
  className,
  title = "Sell on alkemart",
  body = "Open a shop and list products for buyers nationwide.",
  ctaHref,
  ctaLabel = "Start selling",
  ctaTo = "/sell",
}: Props) {
  const primaryClass =
    "inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-sm font-bold text-background transition hover:opacity-90"
  const fieldClass =
    "h-10 w-full min-w-0 flex-1 rounded-full border-0 bg-white px-4 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/15"

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-7",
        className,
      )}
    >
      <span
        className="pointer-events-none absolute -right-1 -top-4 select-none text-[5rem] font-black leading-none text-black/[0.06] sm:text-[6rem]"
        aria-hidden
      >
        02
      </span>

      <div className="relative mx-auto max-w-3xl space-y-4">
        <div className="text-center sm:text-left">
          <h2 className="type-band">{title}</h2>
          <p className="mx-auto mt-1.5 max-w-xl text-sm leading-relaxed opacity-90 sm:mx-0 sm:text-base">
            {body}
          </p>
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault()
            if (ctaHref) {
              window.open(ctaHref, "_blank", "noopener,noreferrer")
            } else {
              window.location.href = ctaTo
            }
          }}
        >
          <input
            type="text"
            name="shop"
            placeholder="Shop name"
            className={fieldClass}
            aria-label="Shop name"
          />
          <input
            type="email"
            name="email"
            placeholder="Email address"
            className={fieldClass}
            aria-label="Email address"
          />
          <button type="submit" className={primaryClass}>
            {ctaLabel}
          </button>
        </form>

        <p className="text-center text-sm opacity-85 sm:text-left">
          Prefer to browse first?{" "}
          <Link to="/sell" className="font-bold underline underline-offset-2">
            Learn how selling works
          </Link>
        </p>
      </div>
    </section>
  )
}
