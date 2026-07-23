import { Link } from "@tanstack/react-router"
import { IconSafe, type IconId } from "@/design/icons"
import { cn } from "@/lib/utils"

export type TrustItem = {
  icon: IconId
  title: string
  body: string
  href?: string
  hrefLabel?: string
}

const DEFAULT_CHECKOUT_ITEMS: TrustItem[] = [
  {
    icon: "cod",
    title: "Pay on delivery",
    body: "Cash to the rider when it arrives.",
  },
  {
    icon: "truck",
    title: "Seller delivery",
    body: "Fees from the seller’s options.",
  },
  {
    icon: "secure",
    title: "Secure checkout",
    body: "Address + delivery before confirm.",
  },
]

type TrustStripProps = {
  variant?: "home" | "checkout"
  items?: TrustItem[]
  className?: string
  title?: string
}

/**
 * Compact trust row — checkout only in the Mowafer rebuild.
 * Home omits this (not on imgi_10).
 */
export function TrustStrip({
  variant = "checkout",
  items,
  className,
  title,
}: TrustStripProps) {
  const list = items ?? DEFAULT_CHECKOUT_ITEMS
  const heading =
    title ??
    (variant === "checkout" ? "Why shop with confidence" : "How alkemart works")

  return (
    <section
      className={cn("space-y-4", className)}
      aria-labelledby="trust-strip-heading"
    >
      <h2
        id="trust-strip-heading"
        className="text-lg font-bold tracking-tight sm:text-xl"
      >
        {heading}
      </h2>
      <ul className={cn("grid gap-3", "sm:grid-cols-3")}>
        {list.map((item) => (
          <li
            key={item.title}
            className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <IconSafe name={item.icon} size={28} />
            </div>
            <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
              {item.body}
            </p>
            {item.href && item.hrefLabel ? (
              <Link
                to={item.href as "/help"}
                className="mt-3 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary"
              >
                {item.hrefLabel}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
