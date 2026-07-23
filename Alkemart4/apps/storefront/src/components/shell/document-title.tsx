import { useEffect } from "react"
import { useRouterState } from "@tanstack/react-router"
import { applyPageSeo, defaultDescription, organizationJsonLd, setJsonLd } from "@/lib/seo"

/**
 * Fallback SEO by path for routes that do not render <PageSeo />.
 * Product/store pages override with API-backed titles + JSON-LD.
 */
const ROUTES: {
  match: (path: string) => boolean
  title: string
  description?: string
  noindex?: boolean
  path?: string
}[] = [
  {
    match: (p) => p === "/",
    title: "Market",
    description: defaultDescription(),
    path: "/",
  },
  {
    match: (p) => p.startsWith("/categories"),
    title: "Categories",
    description: "Browse products and compare multi-seller prices on alkemart.",
  },
  { match: (p) => p.startsWith("/product/"), title: "Product" },
  { match: (p) => p.startsWith("/shops/"), title: "Shop" },
  {
    match: (p) => p === "/cart",
    title: "Cart",
    noindex: true,
    path: "/cart",
  },
  {
    match: (p) => p === "/checkout",
    title: "Checkout",
    noindex: true,
    path: "/checkout",
  },
  {
    match: (p) => p === "/login" || p.startsWith("/login"),
    title: "Sign in",
    noindex: true,
  },
  {
    match: (p) => p === "/account",
    title: "Account",
    noindex: true,
    path: "/account",
  },
  {
    match: (p) => p === "/orders",
    title: "Orders",
    noindex: true,
    path: "/orders",
  },
  {
    match: (p) => p.startsWith("/order/"),
    title: "Order",
    noindex: true,
  },
  {
    match: (p) => p === "/search",
    title: "Search",
    description: "Search products on alkemart.",
    path: "/search",
  },
  {
    match: (p) => p === "/help",
    title: "Help",
    description: "Help and support for alkemart shoppers.",
    path: "/help",
  },
  {
    match: (p) => p === "/shops" || p === "/sellers",
    title: "Shops",
    description: "Discover shops on alkemart.",
    path: "/shops",
  },
  {
    match: (p) => p === "/partners",
    title: "Partners",
    path: "/partners",
  },
  {
    match: (p) => p === "/sell",
    title: "Sell",
    description: "Start selling on alkemart — open Seller Hub.",
    path: "/sell",
  },
]

export function DocumentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    // Product and store pages manage their own SEO with API data
    if (pathname.startsWith("/product/") || pathname.startsWith("/shops/")) {
      return
    }

    const hit = ROUTES.find((t) => t.match(pathname))
    applyPageSeo({
      title: hit?.title ?? "alkemart",
      description: hit?.description,
      path: hit?.path ?? pathname,
      noindex: hit?.noindex,
    })

    if (pathname === "/") {
      setJsonLd(organizationJsonLd())
    } else {
      setJsonLd(null)
    }
  }, [pathname])

  return null
}
