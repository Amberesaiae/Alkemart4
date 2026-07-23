import { createFileRoute, Link } from "@tanstack/react-router"
import { PageSeo } from "@/components/page-seo"
import { brand } from "@/design/brand"
import { IconSafe } from "@/design/icons"
import { absoluteUrl, organizationJsonLd, siteOrigin } from "@/lib/seo"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

const PILLARS = [
  {
    title: "Multi-seller prices",
    body: "Compare offers from independent shops in one place — no single-store lock-in.",
    icon: "package" as const,
  },
  {
    title: "Built for Ghana",
    body: "Cash on delivery, local delivery areas, and Mobile Money when sellers enable it.",
    icon: "truck" as const,
  },
  {
    title: "Seller isolation",
    body: "Each shop owns its catalog and fulfills its own orders. Your cart can mix sellers.",
    icon: "secure" as const,
  },
  {
    title: "Honest catalog",
    body: "Listings and prices come from the live marketplace API — we don’t invent products.",
    icon: "check" as const,
  },
]

function AboutPage() {
  const origin = siteOrigin()
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      {
        "@type": "AboutPage",
        "@id": absoluteUrl("/about"),
        url: absoluteUrl("/about"),
        name: `About ${brand.name}`,
        description:
          "Learn about alkemart — Ghana multi-vendor marketplace for comparing seller prices and shopping with cash on delivery.",
        isPartOf: origin
          ? { "@type": "WebSite", name: brand.name, url: origin }
          : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "About Us",
            item: absoluteUrl("/about"),
          },
        ],
      },
    ],
  }

  return (
    <>
      <PageSeo
        title="About Us"
        description="alkemart is a multi-vendor marketplace for Ghana. Compare multi-seller prices, shop local, and pay cash on delivery."
        path="/about"
        jsonLd={jsonLd}
      />

      <article className="space-y-12 pb-8">
        {/* Hero */}
        <header className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:p-12">
            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                About {brand.name}
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                One market.
                <span className="mt-1 block text-foreground">
                  Many sellers.{" "}
                  <span className="relative inline-block">
                    Fair prices.
                    <span
                      className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-primary"
                      aria-hidden
                    />
                  </span>
                </span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {brand.description} We help shoppers discover shops, compare
                offers, and checkout with confidence — without burying you in
                noise.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/categories/$slug"
                  params={{ slug: "all" }}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Browse products
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-bold text-foreground transition hover:bg-muted"
                >
                  Contact us
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "Compare", v: "Multi-seller offers" },
                { k: "Pay", v: "Cash on delivery" },
                { k: "Shop", v: "Local sellers" },
                { k: "Sell", v: "Seller Hub ready" },
              ].map((c) => (
                <div
                  key={c.k}
                  className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {c.k}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground sm:text-base">
                    {c.v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Mission */}
        <section className="mx-auto max-w-3xl space-y-3 text-center" aria-labelledby="mission-heading">
          <h2
            id="mission-heading"
            className="text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            Our mission
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Make everyday shopping clearer: see who is selling what, at what
            price, and how you’ll pay — with a marketplace that respects sellers
            and shoppers equally.
          </p>
        </section>

        {/* Pillars */}
        <section aria-labelledby="pillars-heading" className="space-y-6">
          <h2
            id="pillars-heading"
            className="text-center text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            What makes alkemart different
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <li
                key={p.title}
                className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-foreground">
                  <IconSafe name={p.icon} size={22} />
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works strip */}
        <section
          className="rounded-3xl border border-border bg-muted/30 p-6 sm:p-8"
          aria-labelledby="how-heading"
        >
          <h2
            id="how-heading"
            className="text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            How shopping works
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "Browse & compare",
                d: "Departments, search, and Last Offers surface real listings from open shops.",
              },
              {
                n: "02",
                t: "Add from any seller",
                d: "Mix items in one cart. Each shop fulfills its own lines.",
              },
              {
                n: "03",
                t: "Checkout with COD",
                d: "Pay the rider. Mobile Money when a seller offers it.",
              },
            ].map((s) => (
              <li key={s.n} className="space-y-2 rounded-2xl bg-card p-5 shadow-sm">
                <span className="text-xs font-bold text-primary">{s.n}</span>
                <h3 className="font-bold text-foreground">{s.t}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section
          className={cn(
            "flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:p-8",
          )}
        >
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold tracking-tight">
              Questions or partnership?
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Reach the alkemart team — shopper support, seller onboarding, or
              press.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Contact Us
            </Link>
            <Link
              to="/sell"
              className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-bold hover:bg-muted"
            >
              Sell on {brand.name}
            </Link>
          </div>
        </section>
      </article>
    </>
  )
}
