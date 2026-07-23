import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import "./styles/index.css"

/** Soft fail analytics/Sentry — never block first paint. */
function bootDeferred() {
  void import("./lib/sentry").then((m) => m.initSentry()).catch(() => {})
  void import("./lib/analytics")
    .then((m) => m.initAnalytics())
    .catch(() => {})
}

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById("root")
if (!root) {
  throw new Error("Missing #root element")
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

// Analytics after first paint — use idle when available
if (typeof window !== "undefined") {
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }
  ).requestIdleCallback
  if (typeof ric === "function") {
    ric(bootDeferred, { timeout: 2500 })
  } else {
    window.setTimeout(bootDeferred, 1200)
  }
}
