import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { getMercurVendorUrl } from "@/lib/env"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/help")({
  component: HelpPage,
})

const FAQ = [
  {
    q: "How do I pay?",
    a: "Cash on delivery is available: pay the rider when your order arrives. Mobile Money (Paystack) is intentionally not enabled in this buyer app until the charge-before-commit payment spine is complete — it is not simulated.",
  },
  {
    q: "How does delivery work?",
    a: "Shipping options come from each seller’s configuration in Mercur. Checkout lists options returned for your cart and attaches them at place-order. Fees are never invented on product pages.",
  },
  {
    q: "Why are items grouped by seller?",
    a: "This is a multi-vendor marketplace. Your cart may contain lines from more than one seller. Each group ships according to that seller’s options when the API provides seller identity on lines.",
  },
  {
    q: "Where do I see my orders?",
    a: "Sign in, then open Orders for account-linked history. Guest checkouts: keep the order id from the confirmation page (or use Find an order / Recent on this device). We do not invent or email order numbers from this SPA.",
  },
  {
    q: "How do I find a guest order later?",
    a: "Copy the order id or link on the confirmation page. On Orders, paste the id under Find an order. Recent ids are stored only on this device after you successfully open an order.",
  },
  {
    q: "How do I sell on alkemart?",
    a: "Open Seller hub from the footer Partners section (Mercur). This app is buyer-only: guest + customer account. Seller and admin RBAC screens are not built into the storefront.",
  },
  {
    q: "What can a signed-in customer do that a guest cannot?",
    a: "Saved addresses, profile edit, and account order history. Guests can still browse, checkout COD, and open an order with the order id from confirmation.",
  },
  {
    q: "Something went wrong with an order",
    a: "Open the order detail, copy the order id, and contact support with that reference. In-app chat is not part of this storefront.",
  },
  {
    q: "Why is a product missing a price or Add to cart?",
    a: "Listings need a live offer (offer_id) and calculated price from the store API. Without those fields the UI shows an honest empty state rather than inventing values.",
  },
] as const

function HelpPage() {
  const [open, setOpen] = useState<string | null>(FAQ[0]?.q ?? null)
  let sellUrl = ""
  try {
    sellUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Support
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Short answers for this marketplace. Policies match what the platform
          has actually implemented — nothing invented for demo polish.
        </p>
      </header>

      <ul className="space-y-2">
        {FAQ.map((item) => {
          const isOpen = open === item.q
          return (
            <li
              key={item.q}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
                onClick={() => setOpen(isOpen ? null : item.q)}
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-foreground">{item.q}</span>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold transition",
                    isOpen && "bg-primary text-primary-foreground",
                  )}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen ? (
                <p className="border-t border-border px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground sm:px-5">
                  {item.a}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="grid gap-2 rounded-3xl border border-border bg-muted/30 p-5 sm:grid-cols-2">
        <QuickLink to="/orders" label="Your orders" />
        <QuickLink to="/account" label="Account & addresses" />
        <QuickLink to="/sellers" label="Sellers" />
        <QuickLink to="/cart" label="Cart" />
        <Link
          to="/partners"
          className="rounded-none border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-foreground"
        >
          Sell / admin (Partners) →
        </Link>
        {sellUrl ? (
          <a
            href={sellUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-none border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-foreground"
          >
            Seller hub →
          </a>
        ) : null}
        <Link
          to="/"
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-primary/40"
        >
          ← Market
        </Link>
      </div>
    </div>
  )
}

function QuickLink({
  to,
  label,
}: {
  to: "/orders" | "/account" | "/sellers" | "/cart"
  label: string
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-primary/40"
    >
      {label} →
    </Link>
  )
}
