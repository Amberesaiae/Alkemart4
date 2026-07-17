import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { getMercurVendorUrl } from "@/lib/env"

export const Route = createFileRoute("/sell")({
  component: SellPage,
})

/**
 * Production-style “Sell on alkemart” entry.
 * Sellers register/log in on Seller Hub (separate app) — same pattern as Jumia Vendor Center.
 * No third-party product names in the UI.
 */
function SellPage() {
  let sellerHub = ""
  try {
    sellerHub = getMercurVendorUrl()
  } catch {
    /* optional */
  }

  const registerUrl =
    sellerHub && !sellerHub.includes("/register")
      ? `${sellerHub.replace(/\/$/, "")}/register`
      : sellerHub
  const loginUrl = sellerHub

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-8">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          For merchants
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Sell on alkemart
          <span className="text-primary">.</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Open a shop, upload products, set delivery options, and reach buyers
          across Ghana. You manage inventory and orders in{" "}
          <strong className="text-foreground">Seller Hub</strong> — customers
          shop on this website.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {registerUrl ? (
            <Button asChild className="min-h-11 rounded-none px-6">
              <a href={registerUrl} target="_blank" rel="noopener noreferrer">
                Open a seller account
              </a>
            </Button>
          ) : (
            <Button className="min-h-11 rounded-none" disabled>
              Seller Hub not configured
            </Button>
          )}
          {loginUrl ? (
            <Button
              asChild
              variant="outline"
              className="min-h-11 rounded-none px-6"
            >
              <a href={loginUrl} target="_blank" rel="noopener noreferrer">
                Seller Hub login
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Step
          n="1"
          title="Register"
          body="Create your seller login in Seller Hub. Use a business email you check often."
        />
        <Step
          n="2"
          title="Set up shop"
          body="Add your store name, location, and shipping. Wait for platform approval if required."
        />
        <Step
          n="3"
          title="List & sell"
          body="Upload products and prices. When buyers order on alkemart, you fulfill from Seller Hub."
        />
      </section>

      <section className="border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight">How it works</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">This website</strong> — buyers
            browse, cart, and pay (e.g. cash on delivery).
          </li>
          <li>
            <strong className="text-foreground">Seller Hub</strong> — you upload
            products, stock, shipping, and handle orders (like Vendor Center on
            large marketplaces).
          </li>
          <li>
            <strong className="text-foreground">Admin</strong> — alkemart ops
            approve shops and manage the platform (not for sellers).
          </li>
        </ul>
      </section>

      <section className="border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <h2 className="font-bold text-foreground">Already a customer?</h2>
        <p className="mt-1">
          Shopper login and seller login are separate. Buying uses{" "}
          <Link to="/signin" search={{}} className="font-semibold underline">
            Sign in
          </Link>{" "}
          here; selling uses Seller Hub only.
        </p>
      </section>

      {!sellerHub ? (
        <p className="text-xs text-destructive">
          Set the seller hub URL in storefront env (
          <code className="text-foreground">VITE_MERCUR_VENDOR_URL</code>
          ) so buttons can open the live Seller Hub.
        </p>
      ) : null}

      <p className="text-sm">
        <Link to="/" className="font-semibold underline">
          ← Back to shop
        </Link>
        {" · "}
        <Link to="/partners" className="font-semibold underline">
          Partners &amp; ops
        </Link>
      </p>
    </div>
  )
}

function Step(props: { n: string; title: string; body: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex h-8 w-8 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
        {props.n}
      </div>
      <h3 className="mt-3 font-bold text-foreground">{props.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {props.body}
      </p>
    </div>
  )
}
