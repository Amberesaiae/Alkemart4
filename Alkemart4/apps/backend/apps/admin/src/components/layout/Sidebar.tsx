import { Link, useRouterState } from "@tanstack/react-router"
import {
  ChartBar,
  Package,
  Storefront,
  ShoppingCart,
  Globe,
  Percent,
  Star,
  Tag,
  ArrowsClockwise,
  Wallet,
  SignOut,
  SidebarSimple as CollapseIcon,
  Sidebar as ExpandIcon,
  CircleNotch,
  Users,
  Scales,
  Stack,
} from "@phosphor-icons/react"
import { useState } from "react"
import { useAuth } from "../../hooks/use-auth"
import { cn } from "@workspace/ui"
import { isWorkersApi } from "../../lib/config"

const ALL_NAV_GROUPS: { label: string; items: { href: string; label: string; icon: React.ElementType; workers?: boolean }[] }[] = [
  {
    label: "Catalogue",
    items: [
      { href: "/analytics", label: "Analytics", icon: ChartBar, workers: true },
      { href: "/markets", label: "Markets", icon: Globe },
      { href: "/categories", label: "Categories", icon: Stack },
      { href: "/featured-products", label: "Featured", icon: Star },
      { href: "/promotions", label: "Promotions", icon: Tag },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingCart, workers: true },
      { href: "/returns", label: "Returns", icon: ArrowsClockwise },
      { href: "/disputes", label: "Disputes", icon: Scales },
      { href: "/reviews", label: "Reviews", icon: Star, workers: true },
      { href: "/payouts", label: "Payouts", icon: Wallet, workers: true },
    ],
  },
  {
    label: "Sellers",
    items: [
      { href: "/sellers-queue", label: "Seller Queue", icon: Storefront, workers: true },
      { href: "/sellers", label: "All Sellers", icon: Users, workers: true },
      { href: "/product-moderation", label: "Product Review", icon: Package, workers: true },
      { href: "/appeals", label: "Appeals", icon: Scales, workers: true },
      { href: "/commission-rates", label: "Commission", icon: Percent },
    ],
  },
]

const NAV_GROUPS = isWorkersApi
  ? ALL_NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.workers),
      }))
      .filter((group) => group.items.length > 0)
  : ALL_NAV_GROUPS

function NavItem({ href, label, icon: Icon, collapsed, isActive }: {
  href: string
  label: string
  icon: React.ElementType
  collapsed: boolean
  isActive: boolean
}) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
      title={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && label}
    </Link>
  )
}

export function Sidebar() {
  const router = useRouterState()
  const { logout, isLoggingOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside aria-label="Sidebar" className={cn(
      "bg-ink text-white flex flex-col h-screen sticky top-0 border-r border-white/10 shrink-0 transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "h-16 flex items-center shrink-0",
        collapsed ? "justify-center px-2" : "px-6"
      )}>
        {collapsed ? (
          <span className="text-xl font-bold text-white">●</span>
        ) : (
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 flex-1">
            <span className="text-primary">●</span> Alkemart Ops
          </h1>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="rounded-md p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ExpandIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <CollapseIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4 space-y-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  collapsed={collapsed}
                  isActive={
                    router.location.pathname === item.href ||
                    (item.href !== "/" && router.location.pathname.startsWith(item.href + "/"))
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 pt-3 shrink-0">
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold transition-all",
            collapsed ? "justify-center px-2" : "",
            "text-white/70 hover:bg-white/10 hover:text-white",
            isLoggingOut && "opacity-50 cursor-not-allowed"
          )}
          title={collapsed ? "Sign out" : undefined}
          aria-label="Sign out"
        >
          {isLoggingOut ? <CircleNotch className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" /> : <SignOut className="h-5 w-5 shrink-0" aria-hidden="true" />}
          {!collapsed && (isLoggingOut ? "Signing out…" : "Sign out")}
        </button>
      </div>
    </aside>
  )
}
