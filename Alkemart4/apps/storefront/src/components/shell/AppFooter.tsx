import { Link } from "@tanstack/react-router"
import { brand } from "@/design/brand"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { Container } from "./Container"
import type { ReactNode } from "react"

type Props = {
  /** External Seller Hub URL (optional). Admin is never linked here. */
  sellUrl?: string
  /** @deprecated Admin must not appear on the public shop — ignored. */
  adminUrl?: string
}

/**
 * Footer: 2-col link grid on mobile (brand full-width above),
 * 5-col row on large screens — avoids a tall single-column stack on phones.
 *
 * Colors: only `.footer-*` tokens from `.site-footer` (light-on-dark).
 * Do not use text-primary-foreground / text-muted-foreground / text-foreground —
 * those are light-theme ink and disappear on the dark bar.
 */
export function AppFooter({ sellUrl = "" }: Props) {
  return (
    <footer
      className="site-footer relative mt-auto border-0 shadow-none"
      role="contentinfo"
    >
      <Container className="relative z-10 grid grid-cols-2 gap-x-6 gap-y-8 pb-10 pt-12 sm:gap-x-8 lg:grid-cols-5 lg:gap-10">
        {/* Brand + payment — full width on mobile, one column on lg */}
        <div className="col-span-2 space-y-3 lg:col-span-1">
          <BrandLogo size="sm" onDark />
          <p className="footer-copy max-w-xs text-sm leading-relaxed">
            {brand.description}
          </p>
          <p className="footer-muted type-sm font-bold uppercase tracking-wider">
            Payment method
          </p>
          <p className="footer-copy text-sm">
            Cash on delivery · Mobile Money (when offered)
          </p>
        </div>

        {/* Link columns sit in a 2×2 grid on phones */}
        <FooterCol title="Shop">
          <FooterLink to="/categories/$slug" params={{ slug: "all" }}>
            All products
          </FooterLink>
          <a href="/#last-offers" className={footerAnchorClass}>
            Last offers
          </a>
          <FooterLink to="/shops">Shops</FooterLink>
          <FooterLink to="/search" search={{ q: "" }}>
            Search
          </FooterLink>
        </FooterCol>

        <FooterCol title="Company">
          <FooterLink to="/about">About Us</FooterLink>
          <FooterLink to="/contact">Contact Us</FooterLink>
          <FooterLink to="/help">Help & FAQ</FooterLink>
          <FooterLink to="/delivery">Delivery</FooterLink>
          <FooterLink to="/privacy">Privacy</FooterLink>
          <FooterLink to="/terms">Terms</FooterLink>
          <FooterLink to="/partners">Partners</FooterLink>
        </FooterCol>

        <FooterCol title="Account">
          <FooterLink to="/orders">Orders</FooterLink>
          <FooterLink to="/account">Account</FooterLink>
          <FooterLink to="/cart">Cart</FooterLink>
          <FooterLink to="/login">Sign in</FooterLink>
        </FooterCol>

        <FooterCol title="Sell">
          <FooterLink to="/sell">Sell on {brand.name}</FooterLink>
          {sellUrl ? (
            <a
              href={sellUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={footerAnchorClass}
            >
              Seller Hub
            </a>
          ) : null}
        </FooterCol>
      </Container>

      {/* Copyright */}
      <div className="relative z-10 bg-black/20">
        <Container className="footer-muted flex flex-col gap-1 py-4 text-center text-sm sm:flex-row sm:justify-between sm:text-start">
          <span>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </span>
          <span>Compare prices · Shop local · COD</span>
        </Container>
      </div>
    </footer>
  )
}

const footerAnchorClass =
  "footer-link inline-flex min-h-11 items-center text-sm transition focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--footer-bg)]"

function FooterCol({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="footer-muted text-xs font-bold uppercase tracking-wider">
        {title}
      </p>
      <nav className="flex flex-col gap-0.5" aria-label={title}>
        {children}
      </nav>
    </div>
  )
}

function FooterLink(props: {
  to: string
  params?: Record<string, string>
  search?: Record<string, string>
  children: ReactNode
}) {
  return (
    <Link
      to={props.to as "/"}
      params={props.params as never}
      search={props.search as never}
      className={footerAnchorClass}
    >
      {props.children}
    </Link>
  )
}
