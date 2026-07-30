import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { QueryClient } from "@tanstack/react-query"
import { Toaster } from "sonner"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <Toaster richColors position="top-right" />
    </div>
  ),
})
