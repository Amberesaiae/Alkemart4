import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { IconSafe, type IconId } from "@/design/icons"
import { Illustration } from "@/components/illustration"
import { getMercurVendorUrl } from "@/lib/env"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/help")({
  component: HelpPage,
})

const FAQ = [
  {
    q: "How do I pay?",
    a: "Cash on delivery — pay the rider. Mobile money when enabled.",
  },
  {
    q: "How does delivery work?",
    a: "Sellers set delivery. Options and fees show at checkout.",
  },
  {
    q: "Why are items grouped by seller?",
    a: "Each shop fulfills its own items. Carts can mix sellers.",
  },
  {
    q: "Where do I see my orders?",
    a: "Sign in → Orders. Guests: look up the order id from confirmation.",
  },
  {
    q: "How do I find a guest order?",
    a: "Use the order id on the confirmation page under Find an order.",
  },
  {
    q: "How do I sell?",
    a: "Open Seller Hub via Sell or Partners. This site is for shopping.",
  },
  {
    q: "Sign in vs guest?",
    a: "Sign-in: addresses, profile, order history. Guests: browse, COD, order lookup.",
  },
  {
    q: "Order problem?",
    a: "Open the order, copy the id, contact support with that reference.",
  },
  {
    q: "No price or Add to cart?",
    a: "The seller is still setting up that listing.",
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
      <header className="grid items-center gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:grid-cols-[1fr_auto] sm:p-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Support
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Help
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Common questions about shopping on alkemart — payments, delivery,
            orders, and selling.
          </p>
        </div>
        <div className="flex justify-center rounded-2xl surface-cream p-4 sm:p-5">
          <Illustration name="customerSupport" size="md" />
        </div>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        <HelpHighlight
          icon="cod"
          title="Payments"
          body="COD and Mobile Money when available."
        />
        <HelpHighlight
          icon="truck"
          title="Delivery"
          body="Options come from each seller at checkout."
        />
        <HelpHighlight
          icon="package"
          title="Orders"
          body="Sign in for history, or use your order id."
        />
      </ul>

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
        <QuickLink to="/shops" label="Sellers" />
        <QuickLink to="/cart" label="Cart" />
        <Link
          to="/sell"
          className="rounded-none border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-foreground"
        >
          Sell →
        </Link>
        {sellUrl ? (
          <a
            href={sellUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-none border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-foreground"
          >
            Seller Hub →
          </a>
        ) : null}
        <Link
          to="/"
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-primary/40"
        >
          ← Shop
        </Link>
      </div>
    </div>
  )
}

function QuickLink({
  to,
  label,
}: {
  to: "/orders" | "/account" | "/shops" | "/cart"
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

function HelpHighlight(props: {
  icon: IconId
  title: string
  body: string
}) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
      <div className="mb-2 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
          <IconSafe name={props.icon} size={28} />
        </div>
      </div>
      <p className="text-sm font-bold text-foreground">{props.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{props.body}</p>
    </li>
  )
}
