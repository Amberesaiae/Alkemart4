import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { getMercurAdminUrl, getMercurVendorUrl } from "@/lib/env"

export const Route = createFileRoute("/partners")({
  component: PartnersPage,
})

/**
 * Role gateway — seller hub vs admin vs buyer (Alkemart branding only).
 * Admin is CLI/invite, not public self-signup.
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
          Partners &amp; ops
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Three different logins. Buyer is this site. Seller and admin are
          Mercur panels on the API host. You cannot create an admin account from
          the admin login form — admins are created with the Medusa CLI (or
          invite).
        </p>
      </header>

      {/* Mental model */}
      <section className="border border-border bg-muted/30 p-5 text-sm">
        <h2 className="font-bold text-foreground">Who is who?</h2>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li>
            <strong className="text-foreground">You as shopper</strong> —{" "}
            <Link to="/signin" search={{}} className="underline">
              Sign in here
            </Link>{" "}
            (customer account). Cart, COD, addresses.
          </li>
          <li>
            <strong className="text-foreground">You as marketplace operator</strong>{" "}
            — Admin dashboard (approve sellers, regions, platform).
          </li>
          <li>
            <strong className="text-foreground">A shop that sells on alkemart</strong>{" "}
            — Seller hub (products, shipping, orders).
          </li>
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <RoleCard
          kicker="Admin"
          title="Platform admin"
          body="There is no public “sign up as admin”. Open Admin and log in with the ops account created for this environment — not the shopper Sign in page."
          authNote="Separate ops login from buyers and sellers."
          bullets={[
            "Approve sellers",
            "Confirm products (if request flow is on)",
            "Regions / currency / sales channels",
          ]}
          primaryHref={adminUrl}
          primaryLabel={adminUrl ? "Open Admin" : "Admin URL not set"}
          disabled={!adminUrl}
          hint={
            adminUrl
              ? "Lab account example: admin@alkemart.local (password set when the admin user was created). Production: create ops users with the backend user CLI."
              : "Set VITE_MERCUR_ADMIN_URL in apps/storefront/.env (seller/admin panel URLs)."
          }
        />
        <RoleCard
          kicker="Seller"
          title="Sell on alkemart"
          body="Sellers self-register in Seller Hub, create a store, then wait for approval. Day-to-day product upload and orders live in Seller Hub — not the shopper account."
          authNote="Seller login is only on Seller Hub."
          bullets={[
            "Register in Seller Hub",
            "Create store (may need approval)",
            "List products → they appear on this website",
          ]}
          primaryHref={sellerRegister || vendorUrl}
          primaryLabel={
            sellerRegister
              ? "Register as seller"
              : "Seller Hub URL not set"
          }
          secondaryHref={vendorUrl}
          secondaryLabel="Seller Hub login"
          disabled={!vendorUrl}
          hint="See also /sell for a buyer-facing pitch page."
        />
      </div>

      <section className="space-y-3 border border-border bg-card p-5">
        <h2 className="text-base font-bold">End-to-end path (first time)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Confirm API:{" "}
            <code className="text-foreground">curl localhost:9000/health</code>
          </li>
          <li>
            Log into{" "}
            <strong className="text-foreground">Admin</strong> (existing user —
            see card).
          </li>
          <li>
            Open{" "}
            <strong className="text-foreground">Seller register</strong>, create
            member + seller profile.
          </li>
          <li>
            In Admin, <strong className="text-foreground">approve</strong> that
            seller.
          </li>
          <li>
            In Seller hub: stock location, product, shipping, offer.
          </li>
          <li>
            Shop on{" "}
            <Link to="/" className="font-medium text-foreground underline">
              this storefront
            </Link>
            .
          </li>
        </ol>
      </section>

      <section className="space-y-2 border border-border bg-card p-5 text-sm text-muted-foreground">
        <h2 className="text-base font-bold text-foreground">
          If you forgot admin password
        </h2>
        <p>
          Create a new admin user from the backend package (Linux worktree
          preferred on WSL):
        </p>
        <pre className="overflow-x-auto border border-border bg-muted/40 p-3 text-xs text-foreground">
{`cd /home/amber/alkemart-backend/packages/api
bunx medusa user -e you@example.com -p 'ChooseAStrongPass'`}
        </pre>
        <p>
          Then sign in at the admin dashboard with that email/password. Full
          write-up:{" "}
          <code className="text-foreground">
            docs/architecture/2026-07-17-mercur-admin-seller-explained.md
          </code>
        </p>
      </section>

      {(!vendorUrl || !adminUrl) && (
        <p className="text-xs text-destructive">
          Set{" "}
          <code className="text-foreground">VITE_MERCUR_VENDOR_URL</code> and{" "}
          <code className="text-foreground">VITE_MERCUR_ADMIN_URL</code> in{" "}
          <code className="text-foreground">apps/storefront/.env</code>. Typical
          local values:{" "}
          <code className="text-foreground">http://localhost:9000/seller</code>{" "}
          and{" "}
          <code className="text-foreground">
            http://localhost:9000/dashboard
          </code>
          .
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        <Link to="/" className="font-semibold text-foreground underline">
          ← Back to shop
        </Link>
        {" · "}
        <Link to="/help" className="font-semibold text-foreground underline">
          Buyer help
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
}) {
  return (
    <article className="flex flex-col border border-border bg-card p-5">
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
