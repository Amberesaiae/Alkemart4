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

/** Links a phone footer still needs: help, trust, legal. Navigation is the tab bar's job. */
const MOBILE_LINKS: FooterLink[] = [
  { label: "Help", to: "/help" },
  { label: "Track an order", to: "/orders" },
  { label: "Delivery", to: "/delivery" },
  { label: "Contact", to: "/contact" },
  { label: "Sell on alkemart", href: getVendorAppUrl() },
  { label: "About", to: "/about" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
]

export function SiteFooter() {
  const market = useMarket()
  return (
    <>
      {/* Phones: the tab bar already navigates, so this stays slim — help, trust and legal only. */}
      <footer className="mt-10 border-t border-border bg-surface md:hidden">
        <div className="container-page space-y-5 pt-6 pb-28">
          <NewsletterForm source="footer-mobile" />
          <nav aria-label="Help and legal">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {MOBILE_LINKS.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="flex min-h-10 items-center text-sm font-medium text-foreground/80 hover:text-foreground">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="flex min-h-10 items-center text-sm font-medium text-foreground/80 hover:text-foreground">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-1.5" aria-label="Payment methods">
              {market.mobileMoney.map((m) => (
                <img key={m.id} src={m.logo} alt={m.name} className="h-6 w-auto rounded bg-white p-0.5" loading="lazy" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} alkemart · {market.name}
            </span>
          </div>
        </div>
      </footer>

      <footer className="mt-16 hidden bg-[#111114] text-white md:block">
        <div className="border-b border-white/10">
          <div className="container-page flex items-center justify-between gap-8 py-8">
            <p className="max-w-sm text-xl font-extrabold">Get the week's best deals and newest shops.</p>
            <div className="w-full max-w-md">
              <NewsletterForm tone="dark" source="footer" />
            </div>
          </div>
        </div>
        <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <BrandLogo tone="light" />
            <p className="max-w-xs text-sm text-white/65">
              Many sellers. More choices. Better prices. Independent shops and trusted sellers in one marketplace.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {market.mobileMoney.map((m) => (
                <img key={m.id} src={m.logo} alt={m.name} className="h-8 w-auto rounded-md bg-white p-1" loading="lazy" />
              ))}
            </div>
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
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/50">
            <span>© {new Date().getFullYear()} alkemart</span>
            <span>Serving {market.name}</span>
          </div>
        </div>
      </footer>
    </>
  )
}
