import { Link, useRouterState } from "@tanstack/react-router"
import { ChartColumn, Package, Store, ShoppingCart, Globe, LogOut } from "lucide-react"
import { useAuth } from "../../hooks/use-auth"
import { cn } from "../../lib/utils"
import { Button } from "../ui/Button"

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

  return (
    <aside className="w-64 bg-[--ink] text-white flex flex-col h-screen sticky top-0 border-r border-border shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="text-primary">●</span> Alkemart Ops
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = router.location.pathname.startsWith(item.href)
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-white/10 shrink-0">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10 gap-3"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
