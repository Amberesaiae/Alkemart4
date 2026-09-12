import { createFileRoute, Link } from "@tanstack/react-router"
import { PageSeo } from "@/components/page-seo"
import { brand } from "@/design/brand"
import { absoluteUrl } from "@/lib/seo"

export const Route = createFileRoute("/terms")({
  component: TermsPage,
})

const SECTIONS = [
  { id: "agreement", n: "1", t: "Agreement & parties" },
  { id: "marketplace-role", n: "2", t: "What alkemart is" },
  { id: "accounts", n: "3", t: "Accounts" },
  { id: "listings", n: "4", t: "Listings, prices & availability" },
  { id: "orders", n: "5", t: "Orders & checkout" },
  { id: "delivery", n: "6", t: "Delivery" },
  { id: "payments", n: "7", t: "Payments: cash on delivery & Mobile Money" },
  { id: "returns", n: "8", t: "Returns, refunds & problems" },
  { id: "reviews", n: "9", t: "Reviews" },
  { id: "sellers", n: "10", t: "Seller terms" },
  { id: "prohibited", n: "11", t: "Prohibited items & conduct" },
  { id: "enforcement", n: "12", t: "Suspension & enforcement" },
  { id: "liability", n: "13", t: "Liability" },
  { id: "ip", n: "14", t: "Intellectual property" },
  { id: "privacy", n: "15", t: "Privacy" },
  { id: "changes", n: "16", t: "Changes to these terms" },
  { id: "law", n: "17", t: "Governing law & contact" },
] as const

function TermsPage() {
  return (
    <>
      <PageSeo
        title="Terms & Conditions"
        description="alkemart Terms & Conditions — the rules for shopping and selling on Ghana's multi-vendor marketplace: orders, delivery, COD and MoMo payments, returns, and seller terms."
        path="/terms"
      />

      <div className="mx-auto max-w-3xl space-y-8 pb-8">
        <header className="overflow-hidden rounded-2xl bg-ink text-white shadow-sm">
          <div className="space-y-3 p-6 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
              Legal
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Terms &amp; Conditions
            </h1>
            <p className="max-w-xl text-sm leading-relaxed opacity-80 sm:text-base">
              The rules for shopping and selling on {brand.name} — Ghana's
              multi-vendor marketplace. By using this website, Seller Hub, or
              placing an order, you agree to these terms.
            </p>
            <p className="text-xs font-semibold opacity-60">
              Last updated: September 2026
            </p>
          </div>
        </header>

        <nav
          aria-label="Terms contents"
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Contents
          </h2>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#terms-${s.id}`}
                  className="text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  <span className="mr-2 font-bold text-primary">{s.n}</span>
                  {s.t}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          <TermsSection id="agreement" n="1" t="Agreement & parties">
            <p>
              These Terms &amp; Conditions ("Terms") form a binding agreement
              between you and {brand.name} ("alkemart", "we"). "You" means any
              shopper, account holder, or seller using the marketplace. Sellers
              accept additional seller terms (section 10) when they register in
              Seller Hub and list products.
            </p>
            <p>
              If you do not agree to these Terms, do not use the marketplace.
              You must be at least 18 years old — or have a parent or guardian
              place orders on your behalf — to buy or sell here.
            </p>
          </TermsSection>

          <TermsSection id="marketplace-role" n="2" t="What alkemart is">
            <p>
              alkemart is a multi-vendor marketplace venue, not the retailer.
              Each shop is an independent seller that owns its catalog, sets its
              own prices, holds its own stock, and fulfills its own orders. When
              you buy, your contract of sale is with the seller shown on the
              product and at checkout — alkemart provides the platform,
              payments rails, and support that connect you.
            </p>
            <p>
              Because shops are independent, one cart can mix items from several
              sellers. Each seller's lines are fulfilled and delivered
              separately, and each seller's delivery fee and policy applies to
              its own lines.
            </p>
          </TermsSection>

          <TermsSection id="accounts" n="3" t="Accounts">
            <p>
              You may shop as a guest with cash on delivery, or create an
              account to keep addresses, view order history, and check out
              faster. You are responsible for keeping your sign-in credentials
              confidential and for all activity under your account.
            </p>
            <p>
              Give accurate details — especially your delivery address, digital
              address where applicable, and a reachable phone number. Failed
              deliveries caused by wrong addresses or unreachable recipients may
              incur a re-delivery fee set by the seller.
            </p>
          </TermsSection>

          <TermsSection id="listings" n="4" t="Listings, prices & availability">
            <p>
              All prices are in Ghana cedis (GH₵) and are set by sellers, not by
              alkemart. Where several sellers offer the same product, the
              marketplace shows competing offers side by side — the price you pay
              is the price of the offer you select at checkout.
            </p>
            <p>
              Stock counts are live but shared: if two shoppers check out the
              last unit at the same time, the first confirmed order wins and the
              other is cancelled without charge. Sellers may correct pricing or
              stock errors; if an error affects your confirmed order, the seller
              will contact you to confirm, adjust, or cancel it.
            </p>
          </TermsSection>

          <TermsSection id="orders" n="5" t="Orders & checkout">
            <p>
              Placing an order is an offer to buy. It is confirmed when the
              seller accepts it — you will see the confirmation and receive an
              order reference. Keep that reference: it is the fastest way for
              support or the seller to find your order.
            </p>
            <p>
              Sellers pack and ship their own orders, usually within 1–3
              business days. If a seller cannot fulfill your order, it is
              cancelled and you pay nothing. alkemart may cancel orders that
              breach these Terms (for example fraud, abuse, or prohibited
              items).
            </p>
          </TermsSection>

          <TermsSection id="delivery" n="6" t="Delivery">
            <p>
              Delivery areas, methods, and fees are set by each seller and shown
              at checkout before you confirm. Riders deliver to your address or
              a pickup point you choose. Delivery times are estimates — traffic,
              weather, and stock movement in Ghana affect them.
            </p>
            <p>
              Be reachable on the delivery day. If the rider cannot reach you
              after reasonable attempts, the order may be returned and a
              re-delivery fee may apply. Inspect items on arrival where
              possible; report damage or wrong items within 48 hours through
              your order page or Contact, quoting your order reference.
            </p>
          </TermsSection>

          <TermsSection
            id="payments"
            n="7"
            t="Payments: cash on delivery & Mobile Money"
          >
            <p>
              <strong className="text-foreground">Cash on delivery (COD)</strong>{" "}
              is the default: hand cash to the rider when your order arrives.
              No cards, no sign-up, no upfront payment. Have the amount ready —
              riders may not carry change for large notes.
            </p>
            <p>
              <strong className="text-foreground">Mobile Money</strong> (MTN,
              Telecel, AT) is available where the seller enables it, processed
              securely through Paystack. alkemart never sees or stores your MoMo
              PIN. If a MoMo charge fails, your order is not confirmed and you
              may retry or switch to COD where offered.
            </p>
          </TermsSection>

          <TermsSection id="returns" n="8" t="Returns, refunds & problems">
            <p>
              Wrong, damaged, or materially different items qualify for return
              or replacement. Each shop publishes its own returns window and
              terms on its shop page; where a shop states none, contact support
              within 7 days of delivery and we will mediate fairly.
            </p>
            <p>
              To start a return: open the order, note the support reference,
              and use Contact with your order id. Keep items unused, with tags
              and packaging, until the return is agreed. COD refunds are paid in
              cash on collection or via MoMo; MoMo-paid orders are refunded to
              the paying wallet. Change-of-mind returns are at the seller's
              discretion unless the listing promised otherwise.
            </p>
          </TermsSection>

          <TermsSection id="reviews" n="9" t="Reviews">
            <p>
              Reviews come from verified purchases only. Write honestly about
              what you received — no paid, fake, or incentivised reviews, and no
              personal data, hate, or threats. Sellers may post one public
              response per review. We may hide reviews that breach these rules
              or these Terms.
            </p>
          </TermsSection>

          <TermsSection id="sellers" n="10" t="Seller terms">
            <p>
              By registering in Seller Hub you confirm you may lawfully sell in
              Ghana, that your products are genuine and as described, and that
              you will fulfill orders promptly, honour your published delivery
              and returns terms, and respond to buyer messages within 2 business
              days.
            </p>
            <p>
              You set retail prices; alkemart deducts the agreed commission
              (shown in Seller Hub before you list) and settles the net to your
              registered MoMo account on the payout schedule. Payouts require a
              verified recipient account in your name. You are responsible for
              your taxes on marketplace income.
            </p>
            <p>
              Product content you upload (photos, descriptions) must be yours or
              licensed to you. Listings that are counterfeit, misleading, or
              breach section 11 are removed, and repeat breaches end the shop
              (see section 12).
            </p>
          </TermsSection>

          <TermsSection id="prohibited" n="11" t="Prohibited items & conduct">
            <p>Across the marketplace, the following are prohibited:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Counterfeit, stolen, or infringing goods.</li>
              <li>
                Weapons, ammunition, illicit drugs, and other goods illegal in
                Ghana.
              </li>
              <li>
                Prescription medicines, unlicensed herbal claims of cure, and
                unsafe cosmetics or chemicals.
              </li>
              <li>
                Adult content, gambling services, and unlicensed financial
                schemes.
              </li>
              <li>
                Fraud, price manipulation, fake orders or reviews, fee evasion,
                and scraping or attacking the platform.
              </li>
              <li>
                Taking buyers off-platform to dodge protections, or harvesting
                buyer data for spam.
              </li>
            </ul>
          </TermsSection>

          <TermsSection id="enforcement" n="12" t="Suspension & enforcement">
            <p>
              We may warn, hide listings, pause payouts, suspend shops or
              accounts, or remove content that breaches these Terms — with or
              without prior notice where safety, fraud, or legality requires
              it. Sellers may appeal through Seller Hub or Contact; shoppers
              may appeal account decisions through Contact with their order or
              account details.
            </p>
          </TermsSection>

          <TermsSection id="liability" n="13" t="Liability">
            <p>
              The platform is provided "as is". To the maximum extent permitted
              by Ghanaian law, alkemart is not liable for seller fulfilment,
              delivery delays, or product quality — your remedy for those lies
              against the seller, with our support mediating under section 8.
            </p>
            <p>
              alkemart's total liability for any claim arising from the
              marketplace is limited to the fees we earned on the affected
              order, or GH₵ 500, whichever is lower. Nothing here limits
              liability that cannot legally be limited, including for fraud or
              wilful misconduct.
            </p>
          </TermsSection>

          <TermsSection id="ip" n="14" t="Intellectual property">
            <p>
              The alkemart name, logo, design, and software belong to alkemart
              or its licensors. Seller and buyer content remains yours; by
              posting it you grant alkemart a licence to display and promote it
              on the marketplace. Report infringement through Contact with
              links and proof of ownership.
            </p>
          </TermsSection>

          <TermsSection id="privacy" n="15" t="Privacy">
            <p>
              How we handle personal data — addresses, phones, MoMo metadata,
              and browsing — is set out in our{" "}
              <Link
                to="/privacy"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
              , which forms part of these Terms.
            </p>
          </TermsSection>

          <TermsSection id="changes" n="16" t="Changes to these terms">
            <p>
              We may update these Terms as the marketplace evolves. Material
              changes are posted here with a new "Last updated" date; continued
              use after posting means you accept them. For significant changes
              affecting sellers (fees, payouts), we give at least 14 days'
              notice in Seller Hub.
            </p>
          </TermsSection>

          <TermsSection id="law" n="17" t="Governing law & contact">
            <p>
              These Terms are governed by the laws of the Republic of Ghana.
              Disputes should first go through support mediation; unresolved
              disputes are subject to the courts of Ghana, seated in Accra.
            </p>
            <p>
              Questions about these Terms: use the{" "}
              <Link
                to="/contact"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Contact page
              </Link>{" "}
              or email hello@alkemart.app. Seller-specific queries go through
              Seller Hub support.
            </p>
          </TermsSection>
        </div>

        <p className="text-center text-sm">
          <Link
            to="/"
            className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
          >
            ← Back to shop
          </Link>
        </p>
      </div>
    </>
  )
}

function TermsSection(props: {
  id: string
  n: string
  t: string
  children: React.ReactNode
}) {
  return (
    <section
      id={`terms-${props.id}`}
      aria-labelledby={`terms-${props.id}-title`}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <h2
        id={`terms-${props.id}-title`}
        className="flex items-baseline gap-2.5 text-lg font-extrabold tracking-tight text-foreground"
      >
        <span className="font-black text-primary">{props.n}</span>
        {props.t}
      </h2>
      <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
        {props.children}
      </div>
    </section>
  )
}
