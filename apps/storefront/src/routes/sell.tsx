import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Illustration } from "@/components/illustration"
import { getMercurVendorUrl } from "@/lib/env"

export const Route = createFileRoute("/sell")({
  component: SellPage,
})

/**
 * “Sell on alkemart” — merchant pitch with brand illustrations.
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
      <header className="grid items-center gap-8 border-b border-border pb-10 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            For merchants
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Sell on alkemart
            <span className="text-primary">.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Open a shop in <strong className="text-foreground">Seller Hub</strong>.
            Buyers find you on this website.
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
                Seller Hub unavailable
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
        </div>
        <div className="flex items-center justify-center rounded-3xl bg-[#faf8f2] p-6 sm:p-8">
          <Illustration name="authSeller" size="lg" priority />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Step
          n="1"
          title="Register"
          body="Create a Seller Hub account with a business email."
          art="shoppingSale"
        />
        <Step
          n="2"
          title="Get approved"
          body="Wait for approval, then set Ghana address and delivery."
          art="doorstepDelivery"
        />
        <Step
          n="3"
          title="List & sell"
          body="Photos, GHS price, stock. Buyers pay COD or MoMo."
          art="cashOnDelivery"
        />
      </section>

      <section className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
        <div className="flex justify-center rounded-2xl bg-[#faf8f2] p-4 ring-1 ring-border/60">
          <Illustration name="cashOnDelivery" size="md" />
        </div>
        <div className="flex flex-col justify-center space-y-3">
          <h2 className="text-lg font-bold tracking-tight">How it works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Shop</strong> — buyers browse
              and checkout.
            </li>
            <li>
              <strong className="text-foreground">Seller Hub</strong> — products,
              stock, orders.
            </li>
          </ul>
        </div>
      </section>

      <section className="border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <h2 className="font-bold text-foreground">Already a customer?</h2>
        <p className="mt-1">
          Buying:{" "}
          <Link to="/login" search={{}} className="font-semibold underline">
            Sign in
          </Link>
          . Selling: Seller Hub only.
        </p>
      </section>

      {!sellerHub ? (
        <p className="text-sm text-muted-foreground">
          Seller Hub unavailable. Try again later.
        </p>
      ) : null}

      <p className="text-sm">
        <Link to="/" className="font-semibold underline">
          ← Back to shop
        </Link>
      </p>
    </div>
  )
}

function Step(props: {
  n: string
  title: string
  body: string
  art: "doorstepDelivery" | "shoppingSale" | "cashOnDelivery"
}) {
  return (
    <div className="flex flex-col border border-border bg-card p-4">
      <div className="mb-3 flex justify-center rounded-xl bg-[#faf8f2] py-3 ring-1 ring-border/50">
        <Illustration name={props.art} size="sm" />
      </div>
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
