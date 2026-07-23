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
    } catch (e) {
      throw redirect({ to: "/login" })
    }
  },
  component: () => (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  ),
})
