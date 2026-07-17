import { useEffect } from "react"
import { useRouterState } from "@tanstack/react-router"

const TITLES: { match: (path: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Market" },
  { match: (p) => p.startsWith("/browse"), title: "Browse" },
  { match: (p) => p.startsWith("/product/"), title: "Product" },
  { match: (p) => p.startsWith("/store/"), title: "Store" },
  { match: (p) => p === "/cart", title: "Cart" },
  { match: (p) => p === "/checkout", title: "Checkout" },
  { match: (p) => p === "/signin", title: "Sign in" },
  { match: (p) => p === "/account", title: "Account" },
  { match: (p) => p === "/orders", title: "Orders" },
  { match: (p) => p.startsWith("/order/"), title: "Order" },
  { match: (p) => p === "/search", title: "Search" },
  { match: (p) => p === "/help", title: "Help" },
  { match: (p) => p === "/sellers", title: "Sellers" },
  { match: (p) => p === "/partners", title: "Partners" },
  { match: (p) => p === "/sell", title: "Sell" },
]

/** Sets document.title from path — no hardcodes of commerce data. */
export function DocumentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    const hit = TITLES.find((t) => t.match(pathname))
    document.title = hit ? `${hit.title} · alkemart` : "alkemart"
  }, [pathname])

  return null
}
