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
 * Footer: compact on mobile (brand row + collapsed link groups +
 * single-line copyright), 5-col row on large screens.
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
      <Container className="relative z-10 grid grid-cols-2 gap-x-6 gap-y-6 pb-6 pt-8 sm:gap-x-8 lg:grid-cols-5 lg:gap-10 lg:pb-10 lg:pt-12">
        {/* Brand + payment — compact row on mobile, one column on lg */}
        <div className="col-span-2 space-y-2 lg:col-span-1 lg:space-y-3">
          <BrandLogo size="sm" onDark />
          <p className="footer-copy hidden max-w-xs text-sm leading-relaxed sm:block">
            {brand.description}
          </p>
          <p className="footer-copy text-sm">
            <span className="footer-muted font-bold uppercase tracking-wider type-sm">Payment · </span>
            Cash on delivery · Mobile Money
          </p>
        </div>

        {/* Link columns collapse into accordions on phones */}
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

      {/* Copyright — single short line on mobile */}
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
  "footer-link inline-flex min-h-11 items-center text-sm transition focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--footer-bg)]"

function FooterCol({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      {/* Collapsed disclosure on mobile keeps the footer short; full column on lg. */}
      <details className="group lg:hidden">
        <summary className="footer-muted flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-1 text-xs font-bold uppercase tracking-wider focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          {title}
          <span aria-hidden="true" className="text-base font-normal leading-none group-open:rotate-45">+</span>
        </summary>
        <nav className="flex flex-col gap-0.5 pb-2" aria-label={title}>
          {children}
        </nav>
      </details>
      <div className="hidden space-y-2 lg:block">
        <p className="footer-muted text-xs font-bold uppercase tracking-wider">
          {title}
        </p>
        <nav className="flex flex-col gap-0.5" aria-label={title}>
          {children}
        </nav>
      </div>
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
