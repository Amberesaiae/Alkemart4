import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /login */
export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "register" ? ("register" as const) : ("login" as const),
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: SigninRedirect,
})

function SigninRedirect() {
  const search = Route.useSearch()
  return <Navigate to="/login" search={search} replace />
}
