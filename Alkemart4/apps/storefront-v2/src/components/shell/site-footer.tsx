import { Link } from "@tanstack/react-router"
import { BrandLogo } from "@/components/brand/brand-logo"
import { getVendorAppUrl } from "@/lib/env"
import { useMarket } from "@/lib/market"
import { NewsletterForm } from "@/components/shell/newsletter-form"

type FooterLink = { label: string; to?: string; href?: string }

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "All categories", to: "/categories" },
      { label: "Stores", to: "/shops" },
      { label: "Buying guides", to: "/guides" },
      { label: "Saved items", to: "/saved" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Help centre", to: "/help" },
      { label: "Track an order", to: "/orders" },
      { label: "Delivery", to: "/delivery" },
      { label: "Contact us", to: "/contact" },
    ],
  },
  {
    title: "alkemart",
    links: [
      { label: "About", to: "/about" },
      { label: "Sell on alkemart", href: getVendorAppUrl() },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
]

/** Phone footer: one slim line. Everything else lives in Account (the tab bar navigates). */
const MOBILE_LINKS: { label: string; to: string }[] = [
  { label: "Help", to: "/help" },
  { label: "Delivery", to: "/delivery" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
]

function FooterActions() {
  return (
    <section className="bg-brand text-brand-foreground" aria-label="Sell on alkemart">
      <div className="container-page py-6 sm:py-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">Sell on alkemart.</h2>
            <p className="mx-auto max-w-xl text-base leading-relaxed sm:text-lg">Your shop. Your way. Smart tools to manage it all.</p>
          </div>
          <a href={getVendorAppUrl()} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-brand-foreground px-6 py-3 text-base font-bold text-brand hover:bg-brand-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-foreground">
            Start selling <span aria-hidden="true" className="ml-2">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}

export function SiteFooter() {
  const market = useMarket()
  return (
    <>
      {/* Phones: a slim, centred line — four links and the copyright. It clears the
          fixed tab bar itself (main adds no bottom padding on phones). */}
      <footer className="mt-10 border-t border-border py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-center md:hidden">
        <nav aria-label="Help and legal" className="container-page">
          <ul className="flex flex-wrap items-center justify-center gap-x-5">
            {MOBILE_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="inline-flex min-h-10 items-center text-[length:var(--text-legacy-13)] font-medium text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} alkemart · {market.name}
        </p>
      </footer>
      <footer className="relative isolate mt-16 hidden overflow-hidden bg-[#111114] text-white md:block">
        <FooterActions />
        <img src="/brand/alkemart-mark.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-20 -z-10 size-96 opacity-[0.035] brightness-0 invert" />
        <img src="/brand/alkemart-mark.png" alt="" aria-hidden="true" className="pointer-events-none absolute top-28 right-8 -z-10 size-56 rotate-12 opacity-[0.025] brightness-0 invert" />
        <img src="/brand/alkemart-mark.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-16 left-[46%] -z-10 size-64 -rotate-12 opacity-[0.025] brightness-0 invert" />
        <div className="container-page grid gap-x-10 gap-y-8 pt-10 pb-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <BrandLogo tone="light" />
            <p className="max-w-xs text-sm text-white/65">
              Many sellers. More choices. Better prices. Independent shops and trusted sellers in one marketplace.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="mb-3 text-sm font-semibold">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className="text-sm text-white/65 hover:text-white">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className="text-sm text-white/65 hover:text-white">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <section className="flex flex-col gap-4 md:col-span-3 md:col-start-2 lg:flex-row lg:items-start lg:gap-6" aria-label="Weekly deals">
            <div className="shrink-0 space-y-1 lg:pt-2">
              <h2 className="text-base font-bold">Good finds, in your inbox.</h2>
              <p className="text-xs text-white/65">Fresh picks. Weekly deals.</p>
            </div>
            <div className="min-w-0 flex-1">
              <NewsletterForm compact tone="dark" source="footer" />
            </div>
          </section>
        </div>
        <div>
          <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/70">
            <span>© {new Date().getFullYear()} alkemart</span>
            <span>Serving {market.name}</span>
          </div>
        </div>
      </footer>
    </>
  )
}
