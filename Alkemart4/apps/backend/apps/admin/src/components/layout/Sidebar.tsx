import { Link, useRouterState } from "@tanstack/react-router"
import { ChartColumn, Package, Store, ShoppingCart, Globe, Percent, Star, Tag, RefreshCw, Wallet, LogOut, PanelLeftClose, PanelLeftOpen, Loader2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "../../hooks/use-auth"
import { cn } from "@workspace/ui"

const NAV_ITEMS = [
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/product-moderation", label: "Product Review", icon: Package },
  { href: "/sellers-queue", label: "Seller Queue", icon: Store },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/markets", label: "Markets", icon: Globe },
  { href: "/commission-rates", label: "Commission", icon: Percent },
  { href: "/featured-products", label: "Featured", icon: Star },
  { href: "/promotions", label: "Promotions", icon: Tag },
  { href: "/returns", label: "Returns", icon: RefreshCw },
  { href: "/payouts", label: "Payouts", icon: Wallet },
]

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
      "bg-ink text-white flex flex-col min-h-screen sticky top-0 border-r border-white/10 shrink-0 transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "h-16 flex items-center border-b border-white/10 shrink-0",
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
          {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            collapsed={collapsed}
            isActive={router.location.pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      <hr className="border-white/10 mx-4" />

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
          {isLoggingOut ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" /> : <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />}
          {!collapsed && (isLoggingOut ? "Signing out…" : "Sign out")}
        </button>
      </div>
    </aside>
  )
}
