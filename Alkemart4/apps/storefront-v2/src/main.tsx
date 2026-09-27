import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"
import { BrandSpinner } from "@/components/brand/brand-logo"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultPendingComponent: () => (
    <div className="grid min-h-[50vh] place-items-center">
      <BrandSpinner />
    </div>
  ),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

// Analytics after first paint; a missing key makes this a no-op.
const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
;(idle ?? ((cb: () => void) => window.setTimeout(cb, 1500)))(() => {
  void import("./lib/analytics").then((m) => m.initAnalytics()).catch(() => {})
})
