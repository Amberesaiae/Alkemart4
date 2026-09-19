import { Outlet, createRootRoute } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider, Button } from "@workspace/ui"
import { brand } from "@/design/brand"
import { Link } from "@tanstack/react-router"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
})

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-dvh bg-background text-foreground">
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
              <Link to="/" className="text-lg font-bold tracking-tight">
                {brand.wordmark}
              </Link>
              <p className="hidden text-sm text-muted-foreground sm:block">{brand.tagline}</p>
              <Button size="sm" asChild>
                <a href="#foundation">shadcn · Radix</a>
              </Button>
            </div>
          </header>
          <main className="mx-auto max-w-[1200px] px-4 py-8">
            <Outlet />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
