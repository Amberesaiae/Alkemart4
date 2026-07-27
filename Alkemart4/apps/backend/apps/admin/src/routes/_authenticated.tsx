import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { auth } from "../lib/api"
import { Sidebar } from "../components/layout/Sidebar"
import { QueryClient } from "@tanstack/react-query"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      const queryClient = context.queryClient as QueryClient;
      const session = await queryClient.fetchQuery({
        queryKey: ["session"],
        queryFn: auth.getSession,
      })
      if (!session) throw new Error("No session")
      if (!session?.user?.role || session.user.role !== "admin") {
        throw new Error("Unauthorized — admin access required")
      }
    } catch (e) {
      throw redirect({ to: "/login" })
    }
  },
  component: () => (
    <div className="flex min-h-screen">
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">
        Skip to content
      </a>
      <Sidebar />
      <main id="admin-content" className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  ),
})
