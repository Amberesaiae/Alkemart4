import type { IconSvgElement } from "@hugeicons/react"
import {
  BookOpen01Icon,
  ChartLineData01Icon,
  DashboardSquare02Icon,
  LegalDocument01Icon,
  Layers01Icon,
  Megaphone01Icon,
  MoneyBag02Icon,
  MoneySend02Icon,
  Message01Icon,
  PackageReceiveIcon,
  PackageSearchIcon,
  Settings02Icon,
  ShoppingCart01Icon,
  StarIcon,
  StoreVerified01Icon,
  WebDesign01Icon,
} from "@hugeicons/core-free-icons"

export type AdminPath =
  | "/"
  | "/orders"
  | "/payouts"
  | "/buyer-reviews"
  | "/sellers"
  | "/appeals"
  | "/listings"
  | "/categories"
  | "/homepage"
  | "/campaigns"
  | "/guides"
  | "/analytics"
  | "/settings"
  | "/business"
  | "/returns"
  | "/messages"

export type AdminNavItem = { to: AdminPath; label: string; icon: IconSvgElement; queue?: "sellers" | "listings" | "appeals" | "reviews" | "returns" | "reports" }

/**
 * Admin destinations grouped by the operator's job (CONSOLE-REDESIGN §4).
 * `queue` marks entries whose badge counts work waiting.
 */
export const NAV_GROUPS: { label?: string; items: AdminNavItem[] }[] = [
  { items: [{ to: "/", label: "Overview", icon: DashboardSquare02Icon }] },
  {
    label: "Operations",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingCart01Icon },
      { to: "/returns", label: "Returns & disputes", icon: PackageReceiveIcon, queue: "returns" },
      { to: "/payouts", label: "Payouts", icon: MoneySend02Icon },
      { to: "/messages", label: "Reports", icon: Message01Icon, queue: "reports" },
      { to: "/buyer-reviews", label: "Buyer reviews", icon: StarIcon, queue: "reviews" },
    ],
  },
  {
    label: "Sellers",
    items: [
      { to: "/sellers", label: "Sellers", icon: StoreVerified01Icon, queue: "sellers" },
      { to: "/appeals", label: "Appeals", icon: LegalDocument01Icon, queue: "appeals" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/listings", label: "Listings", icon: PackageSearchIcon, queue: "listings" },
      { to: "/categories", label: "Categories", icon: Layers01Icon },
    ],
  },
  {
    label: "Storefront",
    items: [
      { to: "/homepage", label: "Homepage", icon: WebDesign01Icon },
      { to: "/campaigns", label: "Campaigns", icon: Megaphone01Icon },
      { to: "/guides", label: "Guides", icon: BookOpen01Icon },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/business", label: "Business", icon: MoneyBag02Icon },
      { to: "/analytics", label: "Search & traffic", icon: ChartLineData01Icon },
    ],
  },
  { label: "Platform", items: [{ to: "/settings", label: "Rules", icon: Settings02Icon }] },
]

export const QUEUE_LABEL = {
  sellers: "applications waiting",
  listings: "listings to review",
  appeals: "open appeals",
  reviews: "reviews to moderate",
  returns: "returns to decide",
  reports: "reported conversations",
} as const
