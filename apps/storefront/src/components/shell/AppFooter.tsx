import { Link } from "@tanstack/react-router"
import { brand } from "@/design/brand"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { Container } from "./Container"

type Props = {
  /** External Seller Hub URL (optional). Admin is never linked here. */
  sellUrl?: string
  /** @deprecated Admin must not appear on the public shop — ignored. */
  adminUrl?: string
}

export function AppFooter({ sellUrl = "" }: Props) {
  return (
    <footer className="relative mt-auto overflow-hidden border-0 bg-[#1a1a1a] text-white shadow-none">
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

      <Container className="relative z-10 grid gap-10 pb-10 pt-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <div className="brightness-0 invert">
            <BrandLogo size="sm" />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-white/60">
            {brand.description}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Payment method
          </p>
          <p className="text-sm text-white/50">
            Cash on delivery · Mobile Money (when offered)
          </p>
        </div>

        <FooterCol title="Shop">
          <FooterLink to="/categories/$slug" params={{ slug: "all" }}>
            All products
          </FooterLink>
          <FooterLink to="/categories/$slug" params={{ slug: "all" }}>
            Last offers
          </FooterLink>
          <FooterLink to="/shops">Shops</FooterLink>
          <FooterLink to="/search" search={{ q: "" }}>
            Search
          </FooterLink>
        </FooterCol>

        <FooterCol title="Account">
          <FooterLink to="/help">Help & FAQ</FooterLink>
          <FooterLink to="/orders">Orders</FooterLink>
          <FooterLink to="/account">Account</FooterLink>
          <FooterLink to="/cart">Cart</FooterLink>
        </FooterCol>

        <FooterCol title="Sell">
          <FooterLink to="/sell">Sell on {brand.name}</FooterLink>
          {sellUrl ? (
            <a
              href={sellUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/50 transition hover:text-white"
            >
              Seller Hub
            </a>
          ) : null}
        </FooterCol>
      </Container>

      {/* Copyright — no light border (avoids white hairline on dark footer) */}
      <div className="relative z-10 bg-black/30">
        <Container className="flex flex-col gap-1 py-4 text-sm text-white/40 sm:flex-row sm:justify-between">
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
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
        {title}
      </p>
      <nav className="flex flex-col gap-2">{children}</nav>
    </div>
  )
}

function FooterLink(props: {
  to: string
  params?: Record<string, string>
  search?: Record<string, string>
  children: React.ReactNode
}) {
  return (
    <Link
      to={props.to as "/"}
      params={props.params as never}
      search={props.search as never}
      className="text-sm text-white/50 transition hover:text-white"
    >
      {props.children}
    </Link>
  )
}
