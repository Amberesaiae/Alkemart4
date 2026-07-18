import { Link } from "@tanstack/react-router"
import { Icon } from "@/components/icon"
import type { IconKey } from "@/lib/icons"
import { cn } from "@/lib/utils"

export type TrustItem = {
  icon: IconKey
  title: string
  body: string
  href?: string
  hrefLabel?: string
}

const DEFAULT_HOME_ITEMS: TrustItem[] = [
  {
    icon: "search-market",
    title: "Multi-seller market",
    body: "Local sellers, one cart.",
    href: "/sellers",
    hrefLabel: "Sellers",
  },
  {
    icon: "money",
    title: "Cash on delivery",
    body: "Pay the rider on arrival.",
    href: "/help",
    hrefLabel: "Payments",
  },
  {
    icon: "delivery-truck",
    title: "Seller delivery",
    body: "Options confirmed at checkout.",
    href: "/help",
    hrefLabel: "Delivery",
  },
  {
    icon: "account",
    title: "Your account",
    body: "Addresses and order history.",
    href: "/signin",
    hrefLabel: "Sign in",
  },
]

const DEFAULT_CHECKOUT_ITEMS: TrustItem[] = [
  {
    icon: "money",
    title: "Pay on delivery",
    body: "Cash to the rider when it arrives.",
  },
  {
    icon: "delivery-truck",
    title: "Seller delivery",
    body: "Fees from the seller’s options.",
  },
  {
    icon: "security",
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
 * Trust / how-it-works row using cleaned IconScout mono icons (light UI).
 */
export function TrustStrip({
  variant = "home",
  items,
  className,
  title,
}: TrustStripProps) {
  const list =
    items ??
    (variant === "checkout" ? DEFAULT_CHECKOUT_ITEMS : DEFAULT_HOME_ITEMS)
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
      <ul
        className={cn(
          "grid gap-3",
          list.length >= 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-3",
        )}
      >
        {list.map((item) => (
          <li
            key={item.title}
            className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Icon name={item.icon} size="md" tone="ink" />
            </div>
            <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
              {item.body}
            </p>
            {item.href && item.hrefLabel ? (
              item.href === "/signin" ? (
                <Link
                  to="/signin"
                  search={{}}
                  className="mt-3 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                >
                  {item.hrefLabel}
                </Link>
              ) : (
                <Link
                  to={item.href as "/help" | "/sellers"}
                  className="mt-3 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                >
                  {item.hrefLabel}
                </Link>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
