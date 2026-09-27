import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import "@workspace/console-ui/globals.css"
import { TooltipProvider } from "@workspace/console-ui/components/tooltip"
import { Toaster } from "@workspace/console-ui/components/sonner"
import { setConsoleMarket } from "@workspace/console-ui/lib/money"
import { routeTree } from "./routeTree.gen"

setConsoleMarket(import.meta.env.VITE_MARKET_CODE as string | undefined)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Auth failures are final; network blips get one quiet retry.
      retry: (count, err) => ((err as { status?: number }).status ?? 0) < 400 && count < 1,
      refetchOnWindowFocus: true,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
