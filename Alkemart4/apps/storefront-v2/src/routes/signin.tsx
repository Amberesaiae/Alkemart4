import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /login */
export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s.redirect === "string" ? { redirect: s.redirect } : {}),
  }),
  component: SigninRedirect,
})

function SigninRedirect() {
  return <Navigate to="/login" search={Route.useSearch()} replace />
}
