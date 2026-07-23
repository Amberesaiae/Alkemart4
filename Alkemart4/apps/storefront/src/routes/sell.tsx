import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Illustration } from "@/components/illustration"
import { getMercurVendorUrl } from "@/lib/env"

export const Route = createFileRoute("/sell")({
  component: SellPage,
})

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
    <div className="mx-auto max-w-3xl space-y-10 overflow-x-hidden pb-8">
      <header className="grid items-center gap-8 border-b border-border pb-10 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
          <div className="flex flex-nowrap gap-2 pt-2">
            {registerUrl ? (
              <Button asChild className="min-h-11 whitespace-nowrap rounded-none px-4 text-sm sm:px-6">
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
                className="min-h-11 whitespace-nowrap rounded-none px-4 text-sm sm:px-6"
              >
                <a href={loginUrl} target="_blank" rel="noopener noreferrer">
                  Seller Hub login
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="surface-cream mt-4 flex items-center justify-center rounded-3xl p-6 sm:mt-0 sm:p-8">
          <Illustration name="authSeller" size="lg" priority alt="Seller Hub illustration" />
        </div>
      </header>

      <section className="grid gap-8 sm:grid-cols-3">
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

      <section className="border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <h2 className="font-bold text-foreground">Already a customer?</h2>
        <p className="mt-1">
          Buying:{" "}
          <Link to="/login" search={{}} className="min-h-11 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
        <Link to="/" className="min-h-11 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
    <div
      className="flex flex-col border border-border bg-card p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Step ${props.n}: ${props.title}`}
    >
      <div className="surface-cream mb-3 flex justify-center rounded-xl py-3 ring-1 ring-border/50">
        <Illustration name={props.art} size="sm" alt="" />
      </div>
      <div className="flex h-10 w-10 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
        {props.n}
      </div>
      <h3 className="mt-3 font-bold text-foreground">{props.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {props.body}
      </p>
    </div>
  )
}
