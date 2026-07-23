import { Link, useRouterState } from "@tanstack/react-router"
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut, Store } from "lucide-react"
import { useCurrentUser, useLogout } from "../lib/auth"
import { cn, Button } from "./ui"

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const router = useRouterState()

  const navItems = [
    { name: "Dashboard", to: "/", icon: LayoutDashboard },
    { name: "Products", to: "/products", icon: Package },
    { name: "Orders", to: "/orders", icon: ShoppingBag },
    { name: "Settings", to: "/settings", icon: Settings },
  ]

  return (
    <div className="flex min-h-[100dvh] w-full bg-background flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-[#1a1a1a] text-white">
        <div className="p-6 border-b border-white/10 flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
            <Store className="h-8 w-8" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">{user?.seller_name || "My Shop"}</h2>
            <p className="text-xs text-white/60 font-medium">{user?.email}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? router.location.pathname === "/seller" || router.location.pathname === "/seller/" : router.location.pathname.startsWith(`/seller${item.to}`)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => logout.mutate()}
            isLoading={logout.isPending}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="md:hidden flex items-center justify-between p-4 bg-[#1a1a1a] text-white sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm">{user?.seller_name || "My Shop"}</span>
          </div>
        </div>
        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1a1a] text-white/70 border-t border-white/10 flex justify-around items-center p-2 pb-safe z-50">
        {navItems.map((item) => {
          const isActive = item.to === "/" ? router.location.pathname === "/seller" || router.location.pathname === "/seller/" : router.location.pathname.startsWith(`/seller${item.to}`)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg min-w-[64px] transition-colors",
                isActive ? "text-primary font-bold" : "hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-[10px] leading-none">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}