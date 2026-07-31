import { Link, useRouterState } from "@tanstack/react-router"
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut, Store, RefreshCw } from "lucide-react"
import { useCurrentUser, useLogout } from "../lib/auth"
import { cn, Button, Avatar, AvatarFallback } from "@workspace/ui"

function avatarInitials(name: string | null | undefined): string {
  if (!name) return "S"
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
  for (const seg of segmenter.segment(name.trim())) {
    return seg.segment
  }
  return "S"
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const router = useRouterState()
  const pathname = router.location.pathname

  const navItems = [
    { name: "Dashboard", to: "/", icon: LayoutDashboard },
    { name: "Products", to: "/products", icon: Package },
    { name: "Orders", to: "/orders", icon: ShoppingBag },
    { name: "Returns", to: "/returns", icon: RefreshCw },
    { name: "Settings", to: "/settings", icon: Settings },
  ]

  const navIsActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to)

  return (
    <div className="flex min-h-[100dvh] w-full bg-background flex-col md:flex-row">
      {/* Skip to content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside aria-label="Sidebar" className="hidden md:flex w-64 flex-col border-r border-border bg-ink text-ink-foreground">
        <div className="p-6 border-b border-ink-foreground/10 flex flex-col items-center text-center gap-3">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-2xl font-bold text-primary-foreground bg-primary">
              {avatarInitials(user?.seller_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-bold text-lg text-ink-foreground">{user?.seller_name || "My Shop"}</h2>
            <p className="text-xs text-ink-foreground/60 font-medium">{user?.email}</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = navIsActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-ink-foreground/70 hover:bg-ink-foreground/10 hover:text-ink-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-ink-foreground/10">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-ink-foreground/70 hover:text-ink-foreground hover:bg-ink-foreground/10"
            onClick={() => logout.mutate()}
            isLoading={logout.isPending}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="md:hidden flex items-center justify-between p-4 bg-ink text-ink-foreground sticky top-0 z-20 shadow-sm">
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
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-ink text-ink-foreground/70 border-t border-ink-foreground/10 flex justify-around items-center p-2 pb-safe z-50">
        {navItems.map((item) => {
          const isActive = navIsActive(item.to)
          return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg min-w-[64px] transition-colors",
                  isActive ? "text-primary font-bold" : "hover:text-ink-foreground"
                )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-5 w-5 mb-1" aria-hidden="true" />
              <span className="text-[10px] leading-none">{item.name}</span>
            </Link>
          )
        })}
        <button
          onClick={() => logout.mutate()}
          className="flex flex-col items-center gap-0.5 text-ink-foreground/60 hover:text-ink-foreground transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          <span className="text-[10px] font-medium">Sign Out</span>
        </button>
      </nav>
    </div>
  )
}