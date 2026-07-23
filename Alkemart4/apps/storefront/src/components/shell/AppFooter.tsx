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
 */
export function AppFooter({ sellUrl = "" }: Props) {
  return (
    <footer
      className="site-footer relative mt-auto overflow-hidden border-0 shadow-none"
      role="contentinfo"
    >
      {/* Soft skyline — very low contrast so it doesn’t read as a white bar */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 opacity-[0.04]"
        aria-hidden
      >
        <svg
          viewBox="0 0 1440 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200V140h40v-20h20v20h30v-40h15v-15h10v15h25v40h50v-60h20v-30h15v30h20v60h40v-80h25v-20h10v20h15v80h60v-50h30v-25h15v25h20v50h45v-70h20v-15h10v15h15v70h55v-90h30v-20h15v20h20v90h40v-40h25v-10h10v10h20v40h50v-100h20v-25h10v25h15v100h35v-60h25v-15h10v15h15v60h60v-120h40v-30h20v30h25v120h50v-80h30v-20h15v20h20v80h45v-50h20v-10h10v10h15v50h55v-150h25v-20h15v20h20v150h40v-70h30v-15h10v15h15v70h50v-40h25v-10h10v10h15v40h60V200H0Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <Container className="relative z-10 grid grid-cols-2 gap-x-6 gap-y-8 pb-10 pt-12 sm:gap-x-8 lg:grid-cols-5 lg:gap-10">
        {/* Brand + payment — full width on mobile, one column on lg */}
        <div className="col-span-2 space-y-3 lg:col-span-1">
          <BrandLogo size="sm" onDark />
          <p className="max-w-xs text-sm leading-relaxed text-white/80">
            {brand.description}
          </p>
          <p className="type-sm font-bold uppercase tracking-wider text-white/70">
            Payment method
          </p>
          <p className="text-sm text-white/75">
            Cash on delivery · Mobile Money (when offered)
          </p>
        </div>

        {/* Link columns sit in a 2×2 grid on phones */}
        <FooterCol title="Shop">
          <FooterLink to="/categories/$slug" params={{ slug: "all" }}>
            All products
          </FooterLink>
          <a
            href="/#last-offers"
            className="inline-flex min-h-11 items-center text-sm text-white/75 transition hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--footer-bg)]"
          >
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
          <FooterLink to="/privacy">Privacy</FooterLink>
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
              className="inline-flex min-h-11 items-center text-sm text-white/75 transition hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--footer-bg)]"
            >
              Seller Hub
            </a>
          ) : null}
        </FooterCol>
      </Container>

      {/* Copyright — no light border (avoids white hairline on dark footer) */}
      <div className="relative z-10 bg-black/30">
        <Container className="flex flex-col gap-1 py-4 text-center text-sm text-white/70 sm:flex-row sm:justify-between sm:text-start">
          <span>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </span>
          <span>Compare prices · Shop local · COD</span>
        </Container>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
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
      className="inline-flex min-h-11 items-center text-sm text-white/75 transition hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--footer-bg)]"
    >
      {props.children}
    </Link>
  )
}
