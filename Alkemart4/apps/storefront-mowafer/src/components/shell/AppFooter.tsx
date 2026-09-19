import { Link } from "@tanstack/react-router"
import { brand } from "@/design/brand"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { Container } from "@workspace/ui"
import type { RailCategory } from "@/lib/catalog-nav"
import type { ReactNode } from "react"

type Props = {
  categories?: RailCategory[]
  sellUrl?: string
}

export function AppFooter({ categories = [], sellUrl = "" }: Props) {
  return (
    <footer className="site-footer relative mt-auto border-0" role="contentinfo">
      <Container className="relative z-10 grid grid-cols-2 gap-x-6 gap-y-6 pb-6 pt-8 sm:gap-x-8 lg:grid-cols-4 lg:gap-10 lg:pb-10 lg:pt-12">
        <div className="col-span-2 space-y-2 lg:col-span-1 lg:space-y-3">
          <BrandLogo size="sm" onDark />
          <p className="footer-copy hidden max-w-xs text-sm leading-relaxed sm:block">
            {brand.tagline}
          </p>
          <p className="footer-copy text-sm">
            <span className="footer-muted font-bold uppercase tracking-wider">Payment · </span>
            Cash on delivery · Paystack
          </p>
        </div>

        <FooterCol title="Categories">
          {categories.slice(0, 6).map((c) => (
            <FooterLink
              key={c.id}
              to="/categories/$slug"
              params={{ slug: (c.handle || c.id).toLowerCase() }}
            >
              {c.name}
            </FooterLink>
          ))}
          <FooterLink to="/categories/$slug" params={{ slug: "all" }}>
            All products
          </FooterLink>
        </FooterCol>

        <FooterCol title="Shop">
          <FooterLink to="/">Home</FooterLink>
          <FooterLink to="/shops">Stores</FooterLink>
          <FooterLink to="/search" search={{ q: undefined }}>
            Search
          </FooterLink>
          <FooterLink to="/cart">Cart</FooterLink>
        </FooterCol>

        <FooterCol title="Legal">
          <FooterLink to="/login">Sign in</FooterLink>
          {sellUrl ? (
            <a href={sellUrl} target="_blank" rel="noopener noreferrer" className={footerAnchorClass}>
              Sell on {brand.name}
            </a>
          ) : (
            <span className={footerAnchorClass}>Sell on {brand.name}</span>
          )}
          <span className="footer-muted text-sm">Privacy</span>
          <span className="footer-muted text-sm">Terms</span>
        </FooterCol>
      </Container>

      <div className="relative z-10 bg-black/20">
        <Container className="footer-muted flex flex-col gap-0.5 py-3 text-center text-xs sm:flex-row sm:justify-between sm:py-4 sm:text-sm sm:text-start">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <span className="hidden sm:inline">Compare prices · Shop local · COD</span>
        </Container>
      </div>
    </footer>
  )
}

const footerAnchorClass =
  "footer-link inline-flex min-h-11 items-center text-sm transition focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <details className="group lg:hidden">
        <summary className="footer-muted flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-1 text-xs font-bold uppercase tracking-wider [&::-webkit-details-marker]:hidden">
          {title}
          <span aria-hidden className="text-base font-normal leading-none transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <nav className="flex flex-col gap-0.5 pb-2" aria-label={title}>
          {children}
        </nav>
      </details>
      <div className="hidden space-y-2 lg:block">
        <p className="footer-muted text-xs font-bold uppercase tracking-wider">{title}</p>
        <nav className="flex flex-col gap-0.5" aria-label={title}>
          {children}
        </nav>
      </div>
    </div>
  )
}

function FooterLink(props: {
  to: "/" | "/shops" | "/search" | "/cart" | "/login" | "/categories/$slug"
  params?: { slug: string }
  search?: { q?: string }
  children: ReactNode
}) {
  return (
    <Link
      to={props.to}
      params={props.params}
      search={props.search}
      className={footerAnchorClass}
    >
      {props.children}
    </Link>
  )
}
