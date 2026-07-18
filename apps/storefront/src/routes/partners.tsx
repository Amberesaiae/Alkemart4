import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Illustration } from "@/components/illustration"
import type { IllustrationKey } from "@/lib/illustrations"
import { getMercurAdminUrl, getMercurVendorUrl } from "@/lib/env"

export const Route = createFileRoute("/partners")({
  component: PartnersPage,
})

/**
 * Public role gateway — shop vs Seller Hub vs Admin with illustrations.
 */
function PartnersPage() {
  let vendorUrl = ""
  let adminUrl = ""
  try {
    vendorUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }
  try {
    adminUrl = getMercurAdminUrl()
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
          Roles
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Partners
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Shoppers, sellers, and admins each use a separate login.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <RoleCard
          kicker="Seller"
          title="Sell on alkemart"
          illustration="authSeller"
          body="Register in Seller Hub, get approved, finish Ghana delivery setup, then list products with photos and GHS offers."
          authNote="Seller Hub only — not the shopper sign-in."
          bullets={[
            "Register shop (pending approval)",
            "Ops approve → stock location & GH shipping",
            "Submit products for review · fulfill orders",
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
              : "Seller Hub is temporarily unavailable. Try again later or contact support."
          }
        />
        <RoleCard
          kicker="Admin"
          title="Platform admin"
          illustration="authAdmin"
          body="Approve sellers, review product proposals, and manage markets. Invitation-only — no public signup."
          authNote="Separate from shopper and seller logins."
          bullets={[
            "Seller queue · product review",
            "Operating markets",
            "Platform settings",
          ]}
          primaryHref={adminUrl}
          primaryLabel={adminUrl ? "Open Admin" : "Admin unavailable"}
          disabled={!adminUrl}
          hint={
            adminUrl
              ? "Use the credentials issued by your team."
              : "Admin is temporarily unavailable. Contact your platform administrator."
          }
        />
      </div>

      <section className="grid gap-4 rounded-3xl border border-border bg-[#faf8f2] p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <Illustration name="authBuyer" size="md" className="mx-0" />
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            Shoppers sign in here
          </h2>
          <p className="text-sm text-muted-foreground">
            Orders and addresses on this website — not Seller Hub.
          </p>
          <Button asChild className="mt-2 rounded-none">
            <Link to="/signin" search={{}}>
              Customer sign in
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3 border border-border bg-card p-5">
        <h2 className="text-base font-bold">Getting started as a seller</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Register in Seller Hub with a business email you check often.</li>
          <li>Complete your store profile and delivery options.</li>
          <li>Wait for platform approval if required.</li>
          <li>List products — they appear for buyers on this site.</li>
          <li>Fulfil orders from Seller Hub when customers check out here.</li>
        </ol>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link to="/" className="font-semibold text-foreground underline">
          ← Back to shop
        </Link>
        {" · "}
        <Link to="/sell" className="font-semibold text-foreground underline">
          Sell on alkemart
        </Link>
        {" · "}
        <Link to="/help" className="font-semibold text-foreground underline">
          Help
        </Link>
      </p>
    </div>
  )
}

function RoleCard(props: {
  kicker: string
  title: string
  body: string
  authNote: string
  bullets: string[]
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  disabled?: boolean
  hint?: string
  illustration: IllustrationKey
}) {
  return (
    <article className="flex flex-col border border-border bg-card p-5">
      <div className="mb-4 flex justify-center rounded-2xl bg-[#faf8f2] py-6">
        <Illustration name={props.illustration} size="md" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {props.kicker}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{props.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {props.body}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{props.authNote}</p>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
        {props.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {props.hint ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {props.hint}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        {props.disabled || !props.primaryHref ? (
          <Button type="button" className="rounded-none" disabled>
            {props.primaryLabel}
          </Button>
        ) : (
          <Button asChild className="rounded-none">
            <a
              href={props.primaryHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {props.primaryLabel}
            </a>
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
    </article>
  )
}
