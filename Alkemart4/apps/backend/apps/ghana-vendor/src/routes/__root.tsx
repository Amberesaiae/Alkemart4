import { createRootRouteWithContext, Outlet, useNavigate } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { useCurrentUser } from "../lib/auth"
import { Layout } from "../components/layout"
import { useEffect } from "react"

interface RouterContext {
  queryClient: QueryClient
}

function RootComponent() {
  const { data: user, isLoading, isError } = useCurrentUser()
  const navigate = useNavigate()
  
  const pathname = window.location.pathname
  const isPublicPage = pathname.includes("/login") || pathname.includes("/register")

  useEffect(() => {
    if (!isLoading && !isPublicPage && (isError || !user)) {
      navigate({ to: "/login" })
    }
  }, [isLoading, isPublicPage, isError, user, navigate])

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Alkemart...</p>
        </div>
      </div>
    )
  }

  if (!isPublicPage && (isError || !user)) {
    return null
  }

  if (isPublicPage) return <Outlet />

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})