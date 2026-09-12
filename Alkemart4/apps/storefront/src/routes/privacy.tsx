import { createFileRoute, Link } from "@tanstack/react-router"
import { PageSeo } from "@/components/page-seo"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
})

const SECTIONS = [
  {
    t: "What we collect",
    body: "Account details (name, email, password hash), delivery addresses including digital addresses, phone numbers, order history, seller shop content (logos, policies, listings), MoMo payment metadata (provider, amounts, references — never your PIN), and basic device/analytics data such as shop views.",
  },
  {
    t: "Why we use it",
    body: "To run the marketplace: show listings, fulfil and deliver orders, process COD and MoMo payments through Paystack, settle seller payouts, detect fraud, and answer support messages. We do not sell personal data, and we never use it for third-party advertising.",
  },
  {
    t: "Who sees it",
    body: "Sellers see the order details they need to fulfil your purchase (items, name, address, phone). Paystack processes MoMo payments under its own protections. We share data with authorities only when legally required in Ghana.",
  },
  {
    t: "Cookies & tracking",
    body: "We use a small set of functional cookies and local storage: sign-in sessions, cart contents, wishlist, and aggregated shop-view counts. No cross-site advertising trackers.",
  },
  {
    t: "Retention",
    body: "Order and payout records are kept as long as tax, accounting, and dispute rules require — typically up to 7 years. Marketing-free accounts can ask for deletion of non-essential data at any time.",
  },
  {
    t: "Your rights",
    body: "Ask what we hold about you, correct mistakes, or request deletion of non-essential data via the Contact page. We respond within 30 days. Where you withdraw consent for optional processing, some features (like saved addresses) stop working.",
  },
  {
    t: "Security",
    body: "Passwords are stored as hashes, sessions expire, admin actions are audit-logged, and seller payouts go only to verified recipient accounts. No system is perfect — report suspected misuse through Contact immediately.",
  },
] as const

function PrivacyPage() {
  return (
    <>
      <PageSeo
        title="Privacy Policy"
        description="alkemart Privacy Policy — what personal data Ghana's multi-vendor marketplace collects, why, and your rights."
        path="/privacy"
      />

      <div className="mx-auto max-w-3xl space-y-8 pb-8">
        <header className="overflow-hidden rounded-2xl bg-ink text-white shadow-sm">
          <div className="space-y-3 p-6 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
              Legal
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="max-w-xl text-sm leading-relaxed opacity-80 sm:text-base">
              What we collect, why we need it, and the rights you hold over
              your data. Short version: we use your data to run your orders —
              nothing else.
            </p>
            <p className="text-xs font-semibold opacity-60">
              Last updated: September 2026
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {SECTIONS.map((s, i) => (
            <section
              key={s.t}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
            >
              <h2 className="flex items-baseline gap-2.5 text-lg font-extrabold tracking-tight text-foreground">
                <span className="font-black text-primary">{i + 1}</span>
                {s.t}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Questions about your data?{" "}
          <Link
            to="/contact"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Contact us
          </Link>{" "}
          · See also our{" "}
          <Link
            to="/terms"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Terms &amp; Conditions
          </Link>
        </p>
      </div>
    </>
  )
}
