import { createFileRoute, Link, Navigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Illustration } from "@/components/illustration"
import type { IllustrationKey } from "@/lib/illustrations"
import {
  getMercurVendorUrl,
  showOpsPartnersPage,
} from "@/lib/env"

export const Route = createFileRoute("/partners")({
  component: PartnersPage,
})

/**
 * Lab/ops role map — Admin is never linked on production shop.
 * Production: redirect to /sell (seller entry only).
 * Lab: seller + shopper cards (no public Admin card).
 */
function PartnersPage() {
  // Production buyer surface: no ops map with admin
  if (!showOpsPartnersPage()) {
    return <Navigate to="/sell" />
  }

  let vendorUrl = ""
  try {
    vendorUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }

  const sellerRegister =
    vendorUrl && !vendorUrl.includes("/register")
      ? `${vendorUrl.replace(/\/$/, "")}/register`
      : vendorUrl

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sell
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Partners
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Sellers use Seller Hub. Shoppers use this website.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-1">
        <RoleCard
          kicker="Seller"
          title="Sell on alkemart"
          illustration="authSeller"
          body="Register → approval → Ghana delivery → list products."
          authNote="Seller Hub only — not shopper sign-in."
          bullets={[
            "Register shop",
            "Ghana delivery setup after approval",
            "List products · fulfill orders",
          ]}
          primaryHref={sellerRegister || vendorUrl}
          primaryLabel={
            sellerRegister ? "Register as seller" : "Seller Hub unavailable"
          }
          secondaryHref={vendorUrl}
          secondaryLabel="Seller Hub login"
          disabled={!vendorUrl}
          hint={
            vendorUrl
              ? undefined
              : "Seller Hub unavailable. Try again later."
          }
        />
      </div>

      <section className="grid gap-4 rounded-3xl border border-border surface-cream p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <Illustration name="authBuyer" size="md" className="mx-0" />
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            Shoppers sign in here
          </h2>
          <p className="text-sm text-muted-foreground">
            Orders and addresses on this website.
          </p>
          <Button asChild className="mt-2 rounded-none">
            <Link to="/login" search={{}}>
              Customer sign in
            </Link>
          </Button>
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Platform admin is invitation-only at a separate secured URL — not linked
        from the shop.
      </p>
    </div>
  )
}

function RoleCard(props: {
  kicker: string
  title: string
  illustration: IllustrationKey
  body: string
  authNote: string
  bullets: string[]
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:gap-6 sm:p-6">
      <Illustration
        name={props.illustration}
        size="md"
        className="mx-0 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {props.kicker}
          </p>
          <h2 className="text-xl font-bold tracking-tight">{props.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{props.body}</p>
          <p className="mt-1 text-xs font-medium text-foreground/70">
            {props.authNote}
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {props.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          {props.primaryHref && !props.disabled ? (
            <Button asChild className="rounded-none">
              <a
                href={props.primaryHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {props.primaryLabel}
              </a>
            </Button>
          ) : (
            <Button className="rounded-none" disabled>
              {props.primaryLabel}
            </Button>
          )}
          {props.secondaryHref && props.secondaryLabel ? (
            <Button asChild variant="outline" className="rounded-none">
              <a
                href={props.secondaryHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {props.secondaryLabel}
              </a>
            </Button>
          ) : null}
        </div>
        {props.hint ? (
          <p className="text-xs text-muted-foreground">{props.hint}</p>
        ) : null}
      </div>
    </article>
  )
}
