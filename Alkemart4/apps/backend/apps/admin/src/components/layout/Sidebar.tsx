import { Link, useRouterState } from "@tanstack/react-router"
import { ChartColumn, Package, Store, ShoppingCart, Globe, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useState } from "react"
import { useAuth } from "../../hooks/use-auth"
import { cn, Button } from "@workspace/ui"

const NAV_ITEMS = [
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/product-moderation", label: "Product Review", icon: Package },
  { href: "/sellers-queue", label: "Seller Queue", icon: Store },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/markets", label: "Markets", icon: Globe },
]

export function Sidebar() {
  const router = useRouterState()
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
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
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = router.location.pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      <div className={cn(
        "p-4 border-t border-white/10 shrink-0",
        collapsed && "p-2"
      )}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white/70 hover:text-white hover:bg-white/10 gap-3",
            collapsed && "justify-center px-2"
          )}
          onClick={() => logout()}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </aside>
  )
}
